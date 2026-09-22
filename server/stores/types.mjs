export const STORE_CHAINS=Object.freeze([
  {slug:'pyaterochka',name:'Пятёрочка',provider:'pyaterochka'},
  {slug:'magnit',name:'Магнит',provider:'magnit'},
  {slug:'perekrestok',name:'Перекрёсток',provider:'perekrestok'},
  {slug:'vkusvill',name:'ВкусВилл',provider:'vkusvill'},
  {slug:'lenta',name:'Лента',provider:'lenta'},
  {slug:'auchan',name:'Ашан',provider:'auchan'},
  {slug:'linia',name:'Линия',provider:'linia'}
]);

export const STORE_CHAIN_SLUGS=Object.freeze(STORE_CHAINS.map(chain=>chain.slug));
export const SHOPPING_PRIORITIES=Object.freeze(['lowest_price','balanced','familiar','no_preference']);

export class StoreProvider {
  constructor({id,chains}) { this.id=id;this.chains=chains; }
  async getStores() { return {status:'not_configured',stores:[]}; }
  async searchProducts() { return {status:'not_configured',products:[]}; }
  async getProduct() { return {status:'not_configured',product:null}; }
  async request(url,{attempts=2,timeoutMs=7000,fetchImpl=fetch}={}) {
    let lastError;
    for(let attempt=0;attempt<attempts;attempt++) {
      const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),timeoutMs);
      try {
        const response=await fetchImpl(url,{signal:controller.signal,headers:{accept:'application/json'}});
        if(!response.ok)throw new Error(`STORE_HTTP_${response.status}`);
        return response;
      } catch(error) { lastError=error; }
      finally { clearTimeout(timer); }
    }
    throw lastError||new Error('STORE_UNAVAILABLE');
  }
}

export const productPriceMinor=product=>product.loyaltyPriceMinor??product.promoPriceMinor??product.priceMinor??product.regularPriceMinor??null;
export const isPriceReady=product=>Number.isInteger(productPriceMinor(product))&&productPriceMinor(product)>=0&&Number.isInteger(product.packageAmount)&&product.packageAmount>0;
