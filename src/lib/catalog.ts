import { defineCatalog } from '@json-render/core';
import { schema } from '@json-render/react/schema';
import { z } from 'zod';
import { components, type Spec } from './domain.ts';
export const catalog=defineCatalog(schema,{
  components:{
    Stack:{props:z.object({}),slots:['default'],description:'Approved Mercury workspace container.'},
    Panel:{props:z.object({kind:z.enum(components)}),description:'Trusted financial panel bound to the demo snapshot. No HTML or external actions.'}
  },actions:{}
});
export function renderSpec(s:Spec) {
  const elements:Record<string,{type:string;props:Record<string,unknown>;children?:string[]}>= {
    root:{type:'Stack',props:{},children:s.components.map((_,i)=>'panel'+i)}
  };
  s.components.forEach((kind,i)=>{elements['panel'+i]={type:'Panel',props:{kind}};});
  return {root:'root',elements};
}
