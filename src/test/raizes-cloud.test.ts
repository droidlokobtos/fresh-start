import { describe, expect, it, vi } from 'vitest';
// @ts-expect-error The static interface shares this native browser module with tests.
import { createCloud, decodeCloud, parentRows } from '../../public/raizes-cloud.mjs';

describe('Shared family tree rules', () => {
  it('preserves explicit parentage independently of gender', () => {
    expect(parentRows({ id:'child',father:'parent-1',mother:'parent-2',gender:'Masculino' },'tree'))
      .toEqual([{tree_id:'tree',parent_id:'parent-1',child_id:'child',parent_role:'parent'},{tree_id:'tree',parent_id:'parent-2',child_id:'child',parent_role:'parent'}]);
  });
  it('does not infer parentage from partnership children', () => {
    const data=decodeCloud([{id:'child',full_name:'Child'}],[{id:'union',person_a_id:'a',person_b_id:'b'}],[],[{partnership_id:'union',child_id:'child'}],[]);
    expect(data.people[0].parents).toEqual([]);
    expect(data.unions[0].children).toEqual(['child']);
  });
  it('uses anonymous public credentials and inserts only, preserving existing people', async () => {
    const existing={id:'person',full_name:'Existing person'};
    const calls: {table:string;method:string;headers:Record<string,string>}[]=[];
    const fetcher=vi.fn(async (url:string,init: {method:string;headers:Record<string,string>})=>{
      const table=new URL(url).pathname.split('/').at(-1) || '';
      calls.push({table,method:init.method,headers:init.headers});
      return new Response(JSON.stringify(table==='family_trees'?[{id:'tree'}]:table==='people'?[existing]:[]),{status:200});
    });
    const cloud=createCloud({url:'https://cloud.example',key:'sb_publishable_test'},fetcher);
    await cloud.load();
    await cloud.insertPerson({id:'person',name:'Existing person'});
    await cloud.insertUnion({id:'union',p1:'person',p2:'',children:['child']});
    expect(calls.filter(c=>c.table==='people'&&c.method!=='GET')).toEqual([]);
    expect(calls.filter(c=>c.method==='POST').map(c=>c.table)).toEqual(['partnerships','partnership_children']);
    expect(calls.every(c=>['GET','POST'].includes(c.method) && c.headers.apikey==='sb_publishable_test' && !('Authorization' in c.headers))).toBe(true);
  });
});