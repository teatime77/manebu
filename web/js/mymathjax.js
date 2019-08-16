
var this_url = document.currentScript.src;
var k = this_url.lastIndexOf('/');
var config_url = this_url.substring(0, k) + "/myconfig.js";
console.log(config_url);

var script = document.createElement('script');
script.setAttribute('src', "https://cdnjs.cloudflare.com/ajax/libs/mathjax/2.7.5/MathJax.js?config=TeX-MML-AM_CHTML," + config_url);
document.head.appendChild(script);  
