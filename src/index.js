export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // 1. If it's not the /secure path, pass it straight to Flask
    if (!path.startsWith('/secure')) {
        return fetch(request);
    }

    // 2. Check for the Cloudflare Access login cookie
    const cookie = request.headers.get('Cookie') || '';
    if (!cookie.includes('CF_Authorization=')) {
        // Not logged in! Step aside so Cloudflare Access can intercept it
        return fetch(request);
    }

    // 3. User is logged in. Decode the cookie to get their email.
    let email = 'Unknown User';
    try {
        const token = cookie.split('CF_Authorization=')[1].split(';')[0];
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64));
        email = payload.email || 'Unknown User';
    } catch (e) {
        console.error("Failed to parse JWT", e);
    }

    const country = request.headers.get('CF-IPCountry') || 'US';

    // 4. Serve the HTML for the main page
    if (path === '/secure' || path === '/secure/') {
       const time = new Date().toISOString();
       const html = `
        <!DOCTYPE html>
        <html>
        <body>
            <p>${email} authenticated at ${time} from <a href="/secure/${country}">${country}</a></p>
        </body>
        </html>
       `;
       return new Response(html, { headers: { 'Content-Type': 'text/html' }});
    }

    // 5. Serve the flag image from R2
    // Grab the country from the URL and force it to UPPERCASE to match R2
    const rawCountryCode = path.split('/')[2]; 
    const cleanCountryCode = decodeURIComponent(rawCountryCode).toUpperCase();
    const fileName = `${cleanCountryCode}.png`;
    
    const object = await env.FLAG_BUCKET.get(fileName);
    
    if (!object) {
        // If it still fails, print out the exact filename it tried to find so you can debug it!
        return new Response(`Flag not found in R2 bucket. The Worker tried to fetch exactly: "${fileName}". Please ensure this file exists in your bucket.`, { status: 404 });
    }
    
    return new Response(object.body, { 
        headers: { 'Content-Type': 'image/png' }
    });
  }
}
