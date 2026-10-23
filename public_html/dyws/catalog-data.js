/** Read an explicitly supplied public PHP snapshot, or fetch for standalone embeds. */
export async function readCatalog(element,{document:doc=globalThis.document,fetch:request=globalThis.fetch}={}) {
 const id=element.getAttribute('catalog-data');
 const source=id?doc.getElementById(id):null;
 if(source?.tagName==='META'&&source.content)return JSON.parse(source.content);
 const response=await request(element.getAttribute('catalog'),{cache:'no-store'});
 if(!response.ok)throw new Error('Catalog unavailable');
 return response.json();
}
