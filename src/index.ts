import { worship, words } from './daily';
import { Differ, diff } from './differ';

export interface Env {
    DISCORD_TOKEN: string;
    WORSHIP_CHANNEL_ID: string;
    PASTE_API_KEY: string;
    PASTE_API_URL: string;
    DATA: KVNamespace;
    DIFFDATA: KVNamespace;
}

interface IDStub {
    id: string;
}

const SCHEDULE: { [hour: string]: (env: Env) => Promise<string> } = {
    '00': worship,
    //'12:00': bible
    '15': words,
}

export default {
    async scheduled(_event: ScheduledEvent, env: Env, _ctx: ExecutionContext) {
        let hour = new Date().toLocaleString('sv-SE', { hour: '2-digit', hour12: false, timeZone: 'Europe/Helsinki' });

        if (SCHEDULE[hour] && !(await env.DATA.get(`schedule_${hour}`))) {
            await SCHEDULE[hour](env)
            await env.DATA.put(`schedule_${hour}`, 'success', { expirationTtl: 7200 });
        }

        let differs = await env.DATA.get<Differ[]>('differs', 'json');
        if (differs) {
            for (let differ of differs) {
                let oldcontent = await env.DIFFDATA.get(differ.id) ?? '';
                let newcontent = await diff(differ, oldcontent, env.PASTE_API_KEY);
                await env.DIFFDATA.put(differ.id, newcontent);
            }
        }

        return Response.json({}, { status: 200 });
    },
    async fetch(request: Request, env: Env, _ctx: ExecutionContext) {
        let { pathname } = new URL(request.url);

        if (pathname === '/proleto/worship') {
            return Response.json(JSON.parse(await worship(env)));
        }
        if (pathname === '/proleto/words') {
            return Response.json(JSON.parse(await words(env)));
        }
        if (pathname === '/proleto/differs' && request.method === 'GET') {
            return Response.json(await env.DATA.get<Differ[]>('differs', 'json'));
        }
        if (pathname === '/proleto/differs' && request.method === 'POST') {
            let differs = await env.DATA.get<Differ[]>('differs', 'json');
            if (differs) {
                for (let differ of differs) {
                    let oldcontent = await env.DIFFDATA.get(differ.id) ?? '';
                    let newcontent = await diff(differ, oldcontent, env.PASTE_API_KEY);
                    await env.DIFFDATA.put(differ.id, newcontent);
                }
            }
            return Response.json({}, { status: 200 });
        }
        if (pathname === '/proleto/differs' && request.method === 'PUT') {
            let newDiffer = await request.json<Differ>();
            if (!newDiffer.id || !newDiffer.type || !newDiffer.webhook || !newDiffer.fetch_url || !newDiffer.fetch_opts) return Response.json({ error: 'Invalid differ' }, { status: 400 });

            let differs = await env.DATA.get<Differ[]>('differs', 'json');
            if (!differs) differs = [];
            differs.push(newDiffer);

            await env.DATA.put('differs', JSON.stringify(differs));
            return Response.json(newDiffer);
        }
        if (pathname === '/proleto/differs' && request.method === 'DELETE') {
            let body = await request.json<IDStub>();
            let differs = await env.DATA.get<Differ[]>('differs', 'json');

            if (!body.id || !differs) return Response.json({ error: 'Invalid differ ID' }, { status: 400 });
            differs = differs.filter(e => e.id !== body.id);
            await env.DATA.put('differs', JSON.stringify(differs));
            await env.DIFFDATA.delete(body.id);
            return Response.json({ id: body.id });
        }

        return Response.json({ error: "I'm a teapot", code: 418 }, { status: 418 });
    }
};
