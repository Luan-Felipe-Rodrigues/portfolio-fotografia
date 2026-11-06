// PostgREST caps each response. Explicit pages keep totals complete.
export async function readAll(makeQuery){
 const data=[];let offset=0;
 while(true){const result=await makeQuery().range(offset,offset+499);if(result.error)return result;data.push(...result.data);if(result.data.length<500)break;offset+=500;}
 return {data,error:null};
}
