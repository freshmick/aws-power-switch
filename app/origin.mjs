// Cross-site request check for state-changing routes. A form on another site, including
// another subdomain of the same zone, can POST here with the Access cookie, so a POST must come
// from the power page itself: the browser says so in Sec-Fetch-Site, or older browsers send Origin.

// headers: lowercased request headers. allowedOrigin: e.g. 'https://power.example.com'.
export function isSameOrigin(headers, allowedOrigin) {
  if (headers['sec-fetch-site'] === 'same-origin') return true;
  return headers.origin === allowedOrigin;
}
