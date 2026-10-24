export const clone=value=>JSON.parse(JSON.stringify(value));
export function starterLayout(stage){
 const layout={rows:1,fields:[]};
 for(const definition of stage.fields.filter(field=>!field.extra)){
  const spot=firstSpace(layout,definition.span);layout.fields.push({id:definition.id,...spot,span:definition.span,align:definition.align||'left',vertical:'top'});layout.rows=Math.max(layout.rows,spot.row);
 }
 return layout;
}
export function occupied(layout,row,column,except){return layout.fields.find(field=>field.id!==except&&field.row===row&&column>=field.column&&column<field.column+field.span);}
export function firstSpace(layout,span=1){
 for(let row=1;row<=30;row++)for(let column=1;column<=3-span;column++)if(!occupied(layout,row,column)&&!(span===2&&occupied(layout,row,2)))return {row,column};
 throw new Error('The layout has reached 30 rows.');
}
export function placeField(layout,field,row,column){
 if(field.span===2)column=1;
 if(!Number.isInteger(row)||row<1||row>30||![1,2].includes(column)||![1,2].includes(field.span)||column+field.span>3)throw new Error('Choose a row from 1 to 30 and one or two columns.');
 const next=clone(layout),old=next.fields.find(item=>item.id===field.id),others=next.fields.filter(item=>item.id!==field.id);
 const conflicts=others.filter(item=>item.row===row&&item.column<column+field.span&&item.column+item.span>column);
 if(conflicts.length){
  if(!old||conflicts.length!==1||conflicts[0].span!==old.span||field.span!==old.span)throw new Error('That space is occupied. Choose an empty cell or insert a row.');
  const swap=conflicts[0];swap.row=old.row;swap.column=old.column;
 }
 next.fields=[...others,{...field,row,column}].sort((a,b)=>a.row-b.row||a.column-b.column);next.rows=Math.max(next.rows,row);return next;
}
export function insertRow(layout,row){
 if(layout.rows>=30)throw new Error('Use up to 30 rows.');
 const next=clone(layout);next.rows++;for(const field of next.fields)if(field.row>=row)field.row++;return next;
}
export function removeRow(layout,row){
 if(layout.rows===1||layout.fields.some(field=>field.row===row))throw new Error('Only empty rows can be removed.');
 const next=clone(layout);next.rows--;for(const field of next.fields)if(field.row>row)field.row--;return next;
}
export function removeField(layout,id,definition){
 if(definition.required)throw new Error(definition.label+' must stay in this stage.');
 return {...clone(layout),fields:layout.fields.filter(field=>field.id!==id)};
}
