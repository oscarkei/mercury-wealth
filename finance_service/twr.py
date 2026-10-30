"""Decimal TWR for contiguous subperiods with external flows at boundaries."""
import hashlib
import json
import re
from datetime import date
from decimal import Decimal, DecimalException, localcontext
from typing import Annotated, Literal

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field, StrictBool, model_validator

ENGINE_VERSION = 'mercury-twr-1.0.0'

def money_string(value):
    if not isinstance(value, str) or not re.fullmatch(r'-?(?:0|[1-9]\d{0,19})(?:\.\d{1,8})?', value):
        raise ValueError('Use a decimal string with at most 20 integer and 8 fractional digits.')
    return value

Money = Annotated[Decimal, BeforeValidator(money_string,json_schema_input_type=str)]

class Model(BaseModel):
    model_config = ConfigDict(extra='forbid',validate_default=True)

class Period(Model):
    start: date
    end: date
    opening_value: Money
    closing_value: Money
    external_flow_start: Money = '0'
    external_flow_end: Money = '0'

    @model_validator(mode='after')
    def check_period(self):
        if self.end <= self.start:
            raise ValueError('Each period end must be after its start.')
        if self.opening_value < 0 or self.closing_value < 0:
            raise ValueError('NAV must be non-negative; leveraged/negative NAV is not supported.')
        if self.opening_value + self.external_flow_start <= 0:
            raise ValueError('Invested capital after the opening flow must be positive.')
        if self.closing_value - self.external_flow_end < 0:
            raise ValueError('Closing NAV before the ending external flow cannot be negative.')
        return self

class Coverage(Model):
    valuations_complete: StrictBool
    external_flows_complete: StrictBool
    flows_at_boundaries_only: StrictBool

    @model_validator(mode='after')
    def check_coverage(self):
        if not (self.valuations_complete and self.external_flows_complete and self.flows_at_boundaries_only):
            raise ValueError('Complete NAV, complete external flows and boundary-only flow timing are required. Split periods at any other flow.')
        return self

class TwrRequest(Model):
    currency: str = Field(pattern=r'^[A-Z]{3}$')
    data_mode: Literal['illustrative','mock','observed']
    fee_basis: Literal['net_of_recorded_fees','gross_of_management_fees','unspecified']
    source_reference: str = Field(min_length=1,max_length=160)
    coverage: Coverage
    periods: list[Period] = Field(min_length=1,max_length=1000)

    @model_validator(mode='after')
    def check_chain(self):
        for previous,current in zip(self.periods,self.periods[1:]):
            if current.start != previous.end:
                raise ValueError('Periods must be ordered and contiguous; gaps and overlaps are rejected.')
            if current.opening_value != previous.closing_value:
                raise ValueError('Each opening NAV must equal the previous closing NAV, including its ending flow.')
        return self

def fixed(value, places=12):
    return format(value.quantize(Decimal(1).scaleb(-places)), 'f')

def calculate_twr(request: TwrRequest):
    with localcontext() as ctx:
        ctx.prec = 60
        factor = Decimal(1)
        results = []
        series = [{'date':request.periods[0].start.isoformat(),'index':'100.00000000','cumulative_twr':'0.000000000000'}]
        try:
            for period in request.periods:
                capital = period.opening_value + period.external_flow_start
                ending_before_flow = period.closing_value - period.external_flow_end
                period_factor = ending_before_flow / capital
                factor *= period_factor
                if factor > Decimal('1e24') or period_factor > Decimal('1e24'):
                    raise ValueError('Return exceeds the supported numeric range.')
                results.append({
                    'start':period.start.isoformat(),'end':period.end.isoformat(),
                    'opening_value':str(period.opening_value),'closing_value':str(period.closing_value),
                    'external_flow_start':str(period.external_flow_start),'external_flow_end':str(period.external_flow_end),
                    'invested_capital':str(capital),'closing_before_end_flow':str(ending_before_flow),
                    'return':fixed(period_factor-1),'return_percent':fixed((period_factor-1)*100,8),
                    'cumulative_twr':fixed(factor-1)
                })
                series.append({'date':period.end.isoformat(),'index':fixed(factor*100,8),'cumulative_twr':fixed(factor-1)})
        except DecimalException as error:
            raise ValueError('Inputs exceed supported decimal precision.') from error
        total_start=sum((p.external_flow_start for p in request.periods),Decimal(0))
        total_end=sum((p.external_flow_end for p in request.periods),Decimal(0))
        raw_start=request.periods[0].opening_value
        raw_change=(request.periods[-1].closing_value/raw_start-1) if raw_start>0 else None
        fingerprint=hashlib.sha256(json.dumps(request.model_dump(mode='json'),sort_keys=True,separators=(',',':')).encode()).hexdigest()
        warnings=['Coverage and fee basis are caller declarations; source records have not been independently audited.','Internal trades, dividends and fees must remain reflected in NAV, not be classified as external flows.']
        if request.data_mode!='observed':warnings.append('Illustrative/mock inputs: this is not actual client performance.')
        if request.fee_basis=='unspecified':warnings.append('Fee basis is unspecified; do not label this result net-of-fees.')
        return {
            'engine':ENGINE_VERSION,'method':'geometrically_linked_boundary_flows',
            'currency':request.currency,'data_mode':request.data_mode,'fee_basis':request.fee_basis,
            'source_reference':request.source_reference,'input_sha256':fingerprint,
            'quality':'caller_declared_complete','start':request.periods[0].start.isoformat(),'end':request.periods[-1].end.isoformat(),
            'twr':fixed(factor-1),'twr_percent':fixed((factor-1)*100,8),
            'nav_change_percent':fixed(raw_change*100,8) if raw_change is not None else None,
            'net_external_flow':str(total_start+total_end),'period_count':len(results),
            'periods':results,'series':series,'warnings':warnings,
            'formula':'period factor = (closing NAV - end external flow) / (opening NAV + start external flow); TWR = product(factors) - 1',
            'annualized':False
        }
