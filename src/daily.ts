import { SUBDIVISIONS } from './data/subdivisions';
import { Env } from '.';
import * as cheerio from 'cheerio';
import { AnyNode } from 'domhandler';

const random = (seed: number): number => {
    let x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
}

let comments: Array<string> = [];

function processNode(dom: cheerio.CheerioAPI, node: cheerio.Cheerio<AnyNode>, depth: number = 0, stack: Array<number> = [], inList: boolean = false) {
    let output = '';

    dom(node).contents().each((_: any, el: any) => {
        const $el = dom(el);

        if (dom($el.children().first()).attr("typeof") === 'mw:File') {
            // drop comment parts of the description
            comments.push($el.text())
        } else if (el.type === 'text') {
            output += $el.text();
        } else if (el.tagName === 'ol') {
            stack.push(1); // start new list
            output += processNode(dom, el, depth + 1, stack, false);
            stack.pop();
        } else if (el.tagName === 'li') {
            const number = stack[stack.length - 1]++;
            let d = Math.max(0, depth - 1);
            output += `${'  '.repeat(d)}${number}. ${processNode(dom, el, depth + 1, stack, true).trim()}`;
        } else if (el.tagName === 'a') {
            let href = $el.attr('href') || '#';
            const text = $el.text().trim();
            if (!href.startsWith('http')) href = 'https://en.wiktionary.org' + href;
            output += inList ? text : `[${text}](${href})`;
        } else if (el.tagName === 'i') {
            output += `*${processNode(dom, el, depth, stack, inList).trim()}*`;
        } else if (el.tagName === 'b') {
            output += `**${processNode(dom, el, depth, stack, inList).trim()}**`;
        } else {
            output += processNode(dom, el, depth, stack, inList).trim();
        }
    });

    return output;
}

interface wikiparse {
    error: any,
    parse: {
        text: {
            '*': string;
        }
    }
}

type Component = {
    type: number;
    components?: Component[];
    content?: string;
}

export const words = async (env: Env): Promise<string> => {
    // Get the date in Helsinki as a string in format "Mm D, YYYY"
    let date = new Date().toLocaleString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Europe/Helsinki' });
    let [day, year] = date.split(', ');

    comments = [];

    let components: Component[] = [{
        type: 10, // text
        content: `### Words of the day\n-# ${day} ${year}`
    }];

    // WOTD
    let wotdhtml = await fetch(`https://en.wiktionary.org/w/api.php?action=parse&format=json&prop=text&page=Wiktionary:Word of the day/${year}/${day}`);
    let wotddata = await wotdhtml.json() as wikiparse;
    if (typeof wotddata.error === 'undefined') {
        let wotd = cheerio.load(wotddata.parse.text['*']);
        let wotdtitle = processNode(wotd, wotd(wotd("#WOTD-rss-title").parentsUntil('tr').last())).trim();
        let wotddesc = processNode(wotd, wotd("#WOTD-rss-description")).trim();

        components.push({
            type: 14 // separator
        }, {
            type: 10,
            content: `-# English\n${wotdtitle}\n${wotddesc}`
        });
    }

    // FWOTD
    let fwotdhtml = await fetch(`https://en.wiktionary.org/w/api.php?action=parse&format=json&prop=text&page=Wiktionary:Foreign Word of the Day/${year}/${day}`);
    let fwotddata = await fwotdhtml.json() as wikiparse;
    if (typeof fwotddata.error === 'undefined') {
        let fwotd = cheerio.load(fwotddata.parse.text['*']);
        let fwotdtitle = processNode(fwotd, fwotd(".headword-line")).trim();
        let fwotddesc = processNode(fwotd, fwotd("#FWOTD-rss-description")).trim();
        let fwotdlang = fwotd("#FWOTD-rss-language").text().trim();

        components.push({
            type: 14 // separator
        }, {
            type: 10,
            content: `-# ${fwotdlang}\n${fwotdtitle}\n${fwotddesc}`
        });
    }

    let finalComponents: Component[] = [{
        type: 17,
        components: components
    }];

    let comment = [...new Set(comments)].map(c => c.replace('\n', '')).join('\n\n');

    if (comment.trim()) finalComponents.unshift({
        type: 10,
        content: comment
    });

    let req = await fetch(`https://discord.com/api/v10/channels/${env.WORSHIP_CHANNEL_ID}/messages`, {
        method: 'POST',
        body: JSON.stringify({
            flags: 1 << 15, // Components V2
            components: finalComponents
        }),
        headers: {
            Authorization: 'Bot ' + env.DISCORD_TOKEN,
            'Content-Type': 'application/json'
        }
    });

    let res = await req.text();
    if (req.status !== 200) throw new Error(res);
    return res;
}

export const worship = async (env: Env): Promise<string> => {
    // Get the date in Helsinki as a string. sv-SE is used as locale for YYYY-MM-SS format.
    let date = new Date().toLocaleString('sv-SE', { year: 'numeric', month: 'numeric', day: 'numeric', timeZone: 'Europe/Helsinki' });
    // Remove leading zeroes to get YYYYMD for legacy purposes
    let seed = parseInt(
        date.split('-').map(component => parseInt(component).toString()).join('')
    );

    let subdivision = SUBDIVISIONS[Math.trunc(random(seed) * SUBDIVISIONS.length)];
    let country = subdivision.parent.toLowerCase().split('-')[0];

    let req = await fetch(`https://discord.com/api/v10/channels/${env.WORSHIP_CHANNEL_ID}`, {
        method: 'PATCH',
        body: JSON.stringify({
            name: `${subdivision.name}-worshipping`,
            topic: `:flag_${country}:`.repeat(3)
        }),
        headers: {
            Authorization: 'Bot ' + env.DISCORD_TOKEN,
            'Content-Type': 'application/json'
        }
    });

    let res = await req.text();
    if (req.status !== 200) throw new Error(res);
    return res;
}

