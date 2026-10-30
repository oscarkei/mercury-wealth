import copy
from decimal import Decimal
from pathlib import Path
import sys
import unittest

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from finance_service.twr import TwrRequest,calculate_twr
from finance_service.api import create_app
from fastapi.testclient import TestClient
from pydantic import ValidationError

def period(opening='100',closing='110',start_flow='0',end_flow='0',start='2026-01-01',end='2026-02-01'):
    return dict(start=start,end=end,opening_value=opening,closing_value=closing,external_flow_start=start_flow,external_flow_end=end_flow)

def request(periods=None):
    return dict(currency='USD',data_mode='illustrative',fee_basis='unspecified',source_reference='Synthetic test fixture',coverage=dict(valuations_complete=True,external_flows_complete=True,flows_at_boundaries_only=True),periods=periods or [period()])

def calc(payload):
    return calculate_twr(TwrRequest.model_validate(payload))

class TwrTests(unittest.TestCase):
    def test_no_flows_matches_simple_return(self):
        self.assertEqual(Decimal(calc(request())['twr']),Decimal('.1'))

    def test_geometric_linking_is_not_sum(self):
        rows=[period(),period('110','99',start='2026-02-01',end='2026-03-01')]
        self.assertEqual(Decimal(calc(request(rows))['twr']),Decimal('-.01'))

    def test_deposit_is_not_investment_return(self):
        rows=[period('100','150',end_flow='50'),period('150','165',start='2026-02-01',end='2026-03-01')]
        result=calc(request(rows));self.assertEqual(Decimal(result['twr']),Decimal('.1'));self.assertEqual(Decimal(result['nav_change_percent']),Decimal('65'))

    def test_start_and_end_timing_produce_different_returns(self):
        self.assertEqual(Decimal(calc(request([period('100','165',start_flow='50')]))['twr']),Decimal('.1'))
        self.assertEqual(Decimal(calc(request([period('100','165',end_flow='50')]))['twr']),Decimal('.15'))

    def test_withdrawals_and_full_exit_are_neutralized(self):
        self.assertEqual(Decimal(calc(request([period('100','80',end_flow='-20')]))['twr']),0)
        self.assertEqual(Decimal(calc(request([period('100','88',start_flow='-20')]))['twr']),Decimal('.1'))
        self.assertEqual(Decimal(calc(request([period('100','0',end_flow='-100')]))['twr']),0)

    def test_actual_total_loss_is_minus_one(self):
        self.assertEqual(Decimal(calc(request([period('100','0')]))['twr']),-1)

    def test_missing_flows_default_to_decimal_zero(self):
        row=period();del row['external_flow_start'];del row['external_flow_end']
        self.assertEqual(Decimal(calc(request([row]))['twr']),Decimal('.1'))

    def test_decimal_money_above_javascript_safe_integer_stays_exact(self):
        result=calc(request([period('9007199254740993.01','9007199254740993.02',start_flow='0.01')]))
        self.assertEqual(result['periods'][0]['invested_capital'],'9007199254740993.02');self.assertEqual(Decimal(result['twr']),0)

    def test_gap_overlap_wrong_order_and_nav_mismatch_rejected(self):
        for row in [period('110','120',start='2026-02-02',end='2026-03-01'),period('110','120',start='2026-01-20',end='2026-03-01'),period('111','120',start='2026-02-01',end='2026-03-01')]:
            with self.subTest(row=row),self.assertRaises(ValidationError):calc(request([period(),row]))

    def test_incomplete_data_cannot_produce_a_return(self):
        for key in request()['coverage']:
            body=request();body['coverage'][key]=False
            with self.subTest(key=key),self.assertRaises(ValidationError):calc(body)

    def test_invalid_money_extra_fields_and_negative_capital_rejected(self):
        for value in [100.0,True,'NaN','Infinity','1e2','00100','1.123456789','-100']:
            with self.subTest(value=value),self.assertRaises(ValidationError):calc(request([period(opening=value)]))
        for row in [period('100','110',start_flow='-100'),period('100','1',end_flow='2'),period(end='2025-12-31')]:
            with self.assertRaises(ValidationError):calc(request([row]))
        body=request();body['annualized']=True
        with self.assertRaises(ValidationError):calc(body)

    def test_quality_and_fee_basis_are_explicit_and_hash_is_stable(self):
        result=calc(request());self.assertEqual(result['quality'],'caller_declared_complete');self.assertFalse(result['annualized']);self.assertEqual(result['data_mode'],'illustrative');self.assertTrue(any('Fee basis' in w for w in result['warnings']));self.assertEqual(result['input_sha256'],calc(request())['input_sha256'])

    def test_money_schema_requires_strings(self):
        schema=TwrRequest.model_json_schema()
        self.assertEqual(schema['$defs']['Period']['properties']['opening_value']['type'],'string')

class ApiTests(unittest.TestCase):
    def setUp(self):
        self.key='synthetic-finance-test-key-0000000000000000'
        self.client=TestClient(create_app(self.key),base_url='http://127.0.0.1')
        self.auth={'Authorization':'Bearer '+self.key}

    def test_health_and_calculation(self):
        self.assertIn('twr',self.client.get('/health').json()['capabilities'])
        response=self.client.post('/v1/twr',json=request(),headers=self.auth);self.assertEqual(response.status_code,200);self.assertEqual(Decimal(response.json()['twr']),Decimal('.1'));self.assertEqual(response.headers['Cache-Control'],'no-store')

    def test_secret_is_required_and_never_echoed(self):
        for headers in [{},{'Authorization':'Bearer wrong'}]:
            response=self.client.post('/v1/twr',json=request(),headers=headers);self.assertEqual(response.status_code,401);self.assertNotIn(self.key,response.text)
        with self.assertRaises(RuntimeError):create_app('')

    def test_bad_inputs_and_oversize_requests(self):
        body=request();body['coverage']['valuations_complete']=False
        response=self.client.post('/v1/twr',json=body,headers=self.auth);self.assertEqual(response.status_code,422);self.assertIn('issues',response.json());self.assertNotIn('input',str(response.json()['issues'][0].keys()))
        response=self.client.post('/v1/twr',content=' '*262145,headers={**self.auth,'Content-Type':'application/json'});self.assertEqual(response.status_code,413)

    def test_host_rebinding_is_rejected(self):
        response=self.client.get('/health',headers={'Host':'attacker.example'});self.assertEqual(response.status_code,400)

if __name__=='__main__':unittest.main()
