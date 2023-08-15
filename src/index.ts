import { COUNTRIES } from './countries';

interface Env {
    DISCORD_TOKEN: string;
    WORSHIP_CHANNEL_ID: string;
    DATA: KVNamespace;
}

let random = (seed: number): number => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

let worship = async (env: Env): Promise<string> => {
    let d = new Date();
    let seed = parseInt(
      `${d.getFullYear()}${d.getMonth() + 1}${d.getDate()}`
    );
    let country = COUNTRIES[Math.floor(random(seed) * COUNTRIES.length)];

    let req = await fetch(`https://discord.com/api/v10/channels/${env.WORSHIP_CHANNEL_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({
            name: `${country.name}-worshipping`,
            topic: `:flag_${country.alpha2Code.toLowerCase()}::flag_${country.alpha2Code.toLowerCase()}::flag_${country.alpha2Code.toLowerCase()}:`
        }),
        headers: {
            Authorization: 'Bot ' + env.DISCORD_TOKEN,
            'Content-Type': 'application/json'
        }
    });

    let res = await req.text()
    if (req.status !== 200) throw new Error(res);
    return res;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        // Get the date in Helsinki as a string. sv-SE is used as locale for YYYY-MM-SS format.
        let date = new Date().toLocaleString('sv-SE', {timeZone: 'Europe/Helsinki'});
        let lastDate = await env.DATA.get('last_worship');

        if (!lastDate || date.split(' ')[0] !== lastDate.split(' ')[0]) {
            await worship(env);
            await env.DATA.put('last_worship', date);
        }

        return Response.json({}, {status: 200});
    },
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        let { pathname } = new URL(request.url);

        if (pathname === '/proleto/worship') return Response.json(JSON.parse(await worship(env)));

        return Response.json({}, {status: 404});
    }
};