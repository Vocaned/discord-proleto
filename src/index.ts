import { worship } from './worship';
import { Differ, diff } from './differ';

interface Env {
    DISCORD_TOKEN: string;
    WORSHIP_CHANNEL_ID: string;
    DATA: KVNamespace;
    DIFFDATA: KVNamespace;
}

interface IDStub {
    id: string;
}

export default {
    async scheduled(event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
        // Get the date in Helsinki as a string. sv-SE is used as locale for YYYY-MM-SS format.
        let date = new Date().toLocaleString('sv-SE', {timeZone: 'Europe/Helsinki'});
        let lastDate = await env.DATA.get('last_worship');

        if (!lastDate || date.split(' ')[0] !== lastDate.split(' ')[0]) {
            await worship(env.WORSHIP_CHANNEL_ID, env.DISCORD_TOKEN);
            await env.DATA.put('last_worship', date);
        }

        let differs = await env.DATA.get<Differ[]>('differs', 'json');
        if (differs) {
            for (let differ of differs) {
                let oldcontent = await env.DIFFDATA.get(differ.id) ?? '';
                let newcontent = await diff(differ, oldcontent);
                await env.DIFFDATA.put(differ.id, newcontent);
            }
        }

        return Response.json({}, {status: 200});
    },
    async fetch(request: Request, env: Env, ctx: ExecutionContext) {
        let { pathname } = new URL(request.url);

        if (pathname === '/proleto/worship') {
            return Response.json(JSON.parse(await worship(env.WORSHIP_CHANNEL_ID, env.DISCORD_TOKEN)));
        }
        if (pathname === '/proleto/differs' && request.method === 'GET') {
            return Response.json(await env.DATA.get<Differ[]>('differs', 'json'));
        }
        if (pathname === '/proleto/differs' && request.method === 'POST') {
            let differs = await env.DATA.get<Differ[]>('differs', 'json');
            if (differs) {
                for (let differ of differs) {
                    let oldcontent = await env.DIFFDATA.get(differ.id) ?? '';
                    let newcontent = await diff(differ, oldcontent);
                    await env.DIFFDATA.put(differ.id, newcontent);
                }
            }
            return Response.json({}, {status: 200});
        }
        if (pathname === '/proleto/differs' && request.method === 'PUT') {
            let newDiffer = await request.json<Differ>();
            if (!newDiffer.id || !newDiffer.type || !newDiffer.webhook || !newDiffer.fetch_url || !newDiffer.fetch_opts) return Response.json({error: 'Invalid differ'}, {status: 400});

            let differs = await env.DATA.get<Differ[]>('differs', 'json');
            if (!differs) differs = [];
            differs.push(newDiffer);

            await env.DATA.put('differs', JSON.stringify(differs));
            return Response.json(newDiffer);
        }
        if (pathname === '/proleto/differs' && request.method === 'DELETE') {
            let body = await request.json<IDStub>();
            let differs = await env.DATA.get<Differ[]>('differs', 'json');

            if (!body.id || !differs) return Response.json({error: 'Invalid differ ID'}, {status: 400});
            differs = differs.filter(e => e.id !== body.id);
            await env.DATA.put('differs', JSON.stringify(differs));
            return Response.json({id: body.id});
        }

        return Response.json({error: "I'm a teapot", code: 418}, {status: 418});
    }
};