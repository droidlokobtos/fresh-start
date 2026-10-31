const gender = {'Feminino':'female','Masculino':'male','Outro':'other','':'unknown'};
const verification = {'Não verificado':'unverified','Relato familiar':'family_report','Documentado':'documented','Confirmado':'confirmed'};
const types = {'Casamento':'marriage','União estável':'stable_union','Namoro':'dating','Relacionamento':'partnership','Parceria parental':'co_parenting','Outro':'other'};
const statuses = {'Atual':'current','Encerrado':'ended','Falecimento':'ended_by_death','Não confirmado':'unknown'};
const reverse = (map, value, fallback) => Object.keys(map).find(key => map[key] === value) ?? fallback;
const nullable = value => value || null;
export function personRow(p, treeId) {
  return {id:p.id,tree_id:treeId,full_name:p.name,birth_name:nullable(p.birthName),nickname:nullable(p.nickname),gender:gender[p.gender] || 'unknown',life_status:p.lifeStatus || 'unknown',verification_status:verification[p.status] || 'unverified',birth_date:nullable(p.birthDate),birth_place:nullable(p.birthPlace),death_date:nullable(p.deathDate),death_place:nullable(p.deathPlace),photo_path:nullable(p.photo),occupation:nullable(p.occupation),biography:nullable(p.story),notes:nullable(p.notes)};
}
export function parentRows(p, treeId) {
  return [...new Set([...(p.parents || []),p.father,p.mother].filter(Boolean))].map(id => ({tree_id:treeId,parent_id:id,child_id:p.id,parent_role:'parent'}));
}
export function partnershipRow(u, treeId) {
  const metadata = {start:u.start || '',end:u.end || ''};
  // A year does not establish a day or month. Preserve it without inventing a date.
  const date = value => /^\d{4}-\d{2}-\d{2}$/.test(value || '') ? value : null;
  return {id:u.id,tree_id:treeId,person_a_id:u.p1,person_b_id:nullable(u.p2),relationship_type:types[u.type] || 'other',relationship_status:statuses[u.status] || 'unknown',start_date:date(u.start),end_date:date(u.end),notes:(u.notes || '')+'\n[raizes-dates:'+JSON.stringify(metadata)+']'};
}
export function decodeCloud(people, unions, links, children, sources) {
  return {people:people.map(p => {
    const parents=[...new Set(links.filter(l=>l.child_id===p.id).map(l=>l.parent_id))];
    return {id:p.id,name:p.full_name,birthName:p.birth_name || '',nickname:p.nickname || '',gender:reverse(gender,p.gender,''),lifeStatus:p.life_status,status:reverse(verification,p.verification_status,'Não verificado'),birthDate:p.birth_date || '',birthPlace:p.birth_place || '',deathDate:p.death_date || '',deathPlace:p.death_place || '',photo:p.photo_path || '',occupation:p.occupation || '',story:p.biography || '',notes:p.notes || '',sources:sources.filter(s=>s.person_id===p.id).map(s=>[s.title,s.description,s.file_path].filter(Boolean).join(' — ')).join('\n'),parents,father:parents[0] || '',mother:parents[1] || '',_cloud:true};
  }),unions:unions.map(u=>{
    let notes=u.notes || '',dates={};
    const match=notes.match(/\n\[raizes-dates:(.*)\]$/);
    if(match){try{dates=JSON.parse(match[1]);notes=notes.slice(0,match.index)}catch{}}
    return {id:u.id,p1:u.person_a_id,p2:u.person_b_id || '',type:reverse(types,u.relationship_type,'Outro'),status:reverse(statuses,u.relationship_status,'Não confirmado'),start:dates.start || u.start_date || '',end:dates.end || u.end_date || '',notes,children:children.filter(c=>c.partnership_id===u.id).map(c=>c.child_id),_cloud:true};
  })};
}
export function createCloud({url,key}, fetcher=fetch) {
  if(!url || !key || !key.startsWith('sb_publishable_')) throw new Error('A configuração pública do Cloud não está disponível.');
  let treeId;
  async function request(table, query='', rows) {
    const response=await fetcher(url.replace(/\/$/,'')+'/rest/v1/'+table+'?'+query,{method:rows ? 'POST':'GET',headers:{apikey:key,...(rows ? {'Content-Type':'application/json',Prefer:'return=representation'}:{})},...(rows ? {body:JSON.stringify(rows)}:{})});
    const body=await response.json();
    if(!response.ok) throw new Error(body.message || 'Não foi possível acessar o Cloud.');
    return body;
  }
  async function list(table, query) {
    const rows=[];
    for(let offset=0;;offset+=500){const batch=await request(table,query+'&order='+ (table==='partnership_children'?'partnership_id,child_id':'id') +'&limit=500&offset='+offset);rows.push(...batch);if(batch.length<500)return rows;}
  }
  async function related(table, field, ids) {
    const result=[];
    for(let i=0;i<ids.length;i+=100) result.push(...await list(table,'select=*&'+field+'=in.('+ids.slice(i,i+100).join(',')+')'));
    return result;
  }
  async function load() {
    const trees=await request('family_trees','select=id&owner_id=is.null&title=eq.'+encodeURIComponent('Árvore Familiar Compartilhada'));
    if(trees.length!==1) throw new Error('É necessária uma única árvore compartilhada configurada neste projeto.');
    treeId=trees[0].id;
    const [people,unions,links]=await Promise.all(['people','partnerships','parent_child_relationships'].map(t=>list(t,'select=*&tree_id=eq.'+treeId)));
    const [children,sources]=await Promise.all([related('partnership_children','partnership_id',unions.map(u=>u.id)),related('person_sources','person_id',people.map(p=>p.id))]);
    return decodeCloud(people,unions,links,children,sources);
  }
  function ready(){if(!treeId)throw new Error('Aguarde a conexão com a árvore compartilhada.');}
  async function insertPerson(p) {
    ready();
    const found=await request('people','select=id,full_name&tree_id=eq.'+treeId+'&id=eq.'+p.id);
    if(!found.length) await request('people','',personRow(p,treeId));
    else if(found[0].full_name!==p.name) throw new Error('O identificador já pertence a outro familiar; nenhum cadastro foi substituído.');
  }
  async function insertDetails(p) {
    ready();
    const known=await list('parent_child_relationships','select=*&tree_id=eq.'+treeId+'&child_id=eq.'+p.id);
    const rows=parentRows(p,treeId).filter(r=>!known.some(k=>k.parent_id===r.parent_id));
    if(rows.length) await request('parent_child_relationships','',rows);
    if(p.sources){
      const sources=await list('person_sources','select=*&person_id=eq.'+p.id);
      if(!sources.some(s=>s.description===p.sources)) await request('person_sources','',{person_id:p.id,source_type:'family_account',description:p.sources});
    }
  }
  async function insertUnion(u) {
    ready();
    const found=await request('partnerships','select=id,person_a_id,person_b_id&tree_id=eq.'+treeId+'&id=eq.'+u.id);
    if(!found.length) await request('partnerships','',partnershipRow(u,treeId));
    else if(found[0].person_a_id!==u.p1 || (found[0].person_b_id || '')!==u.p2) throw new Error('O identificador já pertence a outro relacionamento.');
    const known=await list('partnership_children','select=*&partnership_id=eq.'+u.id);
    const rows=[...new Set(u.children || [])].filter(id=>!known.some(k=>k.child_id===id)).map(id=>({partnership_id:u.id,child_id:id}));
    if(rows.length) await request('partnership_children','',rows);
    // Never create parent-child relationships from a partnership.
  }
  return {load,insertPerson,insertDetails,insertUnion};
}