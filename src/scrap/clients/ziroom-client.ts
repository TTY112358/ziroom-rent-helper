import superAgent from "superagent";
import {HTMLElement} from "node-html-parser";
// @ts-ignore
import Throttle from 'superagent-throttle';
import {TaskNode} from "../nodes/task-node";
import {ScrapPagePipelineNode} from "../nodes/scrap-page-pipeline-node";
import {ParallelTaskNode} from "../nodes/parallel-task-node";
import {ReduceNode} from "../nodes/reduce-node";
import {ParallelMergeNode} from "../nodes/parallel-merge-node";


async function main() {
    ScrapPagePipelineNode.defaultAgent = superAgent.agent().use(new Throttle({
        rate: 5,
        ratePer: 1000,
        concurrent: 5,
    }).plugin());
    const n1 = new ScrapPagePipelineNode({
        input: [
            "http://sh.ziroom.com/z/",
        ]
    });
    const n2 = new TaskNode({previousNode: n1}, ([r]) => r);
    const n3 = new TaskNode({previousNode: n2}, ele => {
        const liElement = ele.document.querySelectorAll("div.Z_filter ul li.f-item").find(e => e.querySelector("strong.title").text.trim() === '找房方式') as HTMLElement;
        const optDivElement = liElement.querySelectorAll("div.opt-type").find(e => e.querySelector(".opt-name").text.trim() === '区域') as HTMLElement;
        const aElements = optDivElement.querySelectorAll("div.child-opt div.wrapper a.item");
        return aElements.map(a => ({url: `http:${a.getAttribute("href")}`, district: a.text.trim()}));
    });
    const n4 = new ParallelTaskNode({previousNode: n3}, (e) => e.url);
    const n5 = new ScrapPagePipelineNode({previousNode: n4});
    const n6 = new ParallelTaskNode({previousNode: n5}, ele => {
        const liElement = ele.document.querySelectorAll("div.Z_filter ul li.f-item").find(e => e.querySelector("strong.title").text.trim() === '找房方式') as HTMLElement;
        const optDivElement = liElement.querySelectorAll("div.opt-type").find(e => e.querySelector(".opt-name").text.trim() === '区域') as HTMLElement;
        const aElements = optDivElement.querySelectorAll("div.grand-child-opt a.checkbox");
        return aElements.map(a => ({url: `http:${a.getAttribute("href")}`, subDistrict: a.text.trim()}));
    });
    const m1 = new ParallelMergeNode<[{ url: string, district: string }, { url: string, subDistrict: string }[]],
        { url: string, district: string, subDistrict: string }[]>({
        sources: [
            {previousNode: n3},
            {previousNode: n6},
        ]
    }, ([n3Output, n6Output]) => {
        return n6Output.map(({url, subDistrict}) => ({
            url, subDistrict,
            district: n3Output.district,
        }));
    });
    const n7 = new ReduceNode({previousNode: m1});
    const n8 = new ParallelTaskNode({previousNode: n7}, e => e.url);
    const n9 = new ScrapPagePipelineNode({previousNode: n8});
    const n10 = new ParallelTaskNode({previousNode: n9}, ele => {
        const pageElement = ele.document.querySelector("#page") as HTMLElement | null;
        const url = ele.url;
        const getPageInfo = (page: number) => {
            if (url.endsWith('/')) {
                return {page, url: `${url.substr(0, url.length - 1)}-p${page}/`};
            } else {
                return {page, url: `${url}-p${page}/`};
            }
        };
        let pages = 0;
        if (pageElement) {
            const spanElements = pageElement.querySelectorAll("span");
            const pageInfoSpan = spanElements.find(s => /共\d+页/.test(s.text.trim())) as HTMLElement;
            pages = pageInfoSpan ? parseInt((/共(\d+)页/.exec(pageInfoSpan.text.trim()) as RegExpExecArray)[1]) : 1;
        }
        return new Array(pages).fill(null).map((_, idx) => getPageInfo(idx + 1));
    });
    const m2 = new ParallelMergeNode<[{ url: string, district: string, subDistrict: string }, { page: number, url: string }[]],
        { url: string, district: string, subDistrict: string, page: number }[]>({
        sources: [
            {previousNode: n7},
            {previousNode: n10},
        ]
    }, ([n7Output, n10Output]) => {
            return n10Output.map(e=>({
                ...n7Output,
                ...e,
            }));
    });
    const n11 = new ReduceNode({previousNode: m2});
    const n12 = new ParallelTaskNode({previousNode: n11}, e=>e.url);
    const n13 = new ScrapPagePipelineNode({previousNode: n12});
    const opt = await n13.getOutput();
    console.log(opt);
}

main().then();

