self.addEventListener("fetch",(event)=>{

event.respondWith(

fetch(event.request)

.then((response)=>{

const copy=response.clone();

caches.open(CACHE_NAME)

.then(cache=>cache.put(event.request,copy));

return response;

})

.catch(()=>{

return caches.match(event.request)

.then(res=>{

return res || caches.match("./offline.html");

});

})

);

});
