import superAgent from "superagent";
import {HTMLElement} from "node-html-parser";
// @ts-ignore
import Throttle from 'superagent-throttle';
import {TaskNode} from "../nodes/task-node";
import {ScrapPagePipelineNode} from "../nodes/scrap-page-pipeline-node";
import {ParallelTaskNode} from "../nodes/parallel-task-node";


async function main() {
    ScrapPagePipelineNode.defaultAgent = superAgent.agent().use(new Throttle({
        rate: 5,
        ratePer: 1000,
        concurrent: 5,
    }).plugin());
    const scrapNode1 = new ScrapPagePipelineNode({
        input: [
            "http://sh.ziroom.com/z/z0-s310000100004/",
        ]
    });
    const reduceNode = new TaskNode({previousNode: scrapNode1}, ([r]) => r);
    const extractorNode1 = new TaskNode({previousNode: reduceNode}, ele => {
        const liElement = ele.document.querySelectorAll("div.Z_filter ul li.f-item").find(e => e.querySelector("strong.title").text.trim() === '找房方式') as HTMLElement;
        const optDivElement = liElement.querySelectorAll("div.opt-type").find(e => e.querySelector(".opt-name").text.trim() === '区域') as HTMLElement;
        const aElements = optDivElement.querySelectorAll("div.child-opt div.wrapper a.item");
        return aElements.map(a => ({url: `http:${a.getAttribute("href")}`, district: a.text.trim()}));
    });
    const scrapNode2 = new ScrapPagePipelineNode({
        previousNode: new ParallelTaskNode({previousNode: extractorNode1}, e => e.url),
    });
    const extractorNode2 = new ParallelTaskNode({previousNode: scrapNode2}, ele => {
        const liElement = ele.document.querySelectorAll("div.Z_filter ul li.f-item").find(e => e.querySelector("strong.title").text.trim() === '找房方式') as HTMLElement;
        const optDivElement = liElement.querySelectorAll("div.opt-type").find(e => e.querySelector(".opt-name").text.trim() === '区域') as HTMLElement;
        const aElements = optDivElement.querySelectorAll("div.grand-child-opt a.checkbox");
        return aElements.map(a => ({url: `http:${a.getAttribute("href")}`, subDistrict: a.text.trim()}));
    });
    const scrapNode3 = new ScrapPagePipelineNode({
        previousNode: new ParallelTaskNode({
            previousNode: new TaskNode({previousNode: extractorNode2}, listOfURLList => {
                return listOfURLList.reduce((resultList, urlList) => [...resultList, ...urlList], []);
            }),
        }, e => e.url),
    });
    const extractorNode3 = new ParallelTaskNode({previousNode: scrapNode3}, ele => {
        const pageElement = ele.document.querySelector("#page") as HTMLElement | null;
        const url = ele.url;
        const getPage = (page: number) => {
            if (url.endsWith('/')) {
                return `${url.substr(0, url.length - 1)}-p${page}/`;
            } else {
                return `${url}-p${page}/`;
            }
        };
        if (!pageElement) {
            return [] as string[];
        } else {
            const spanElements = pageElement.querySelectorAll("span");
            const pageInfoSpan = spanElements.find(s => /共\d+页/.test(s.text.trim())) as HTMLElement;
            const totalPageNumber = pageInfoSpan ? parseInt((/共(\d+)页/.exec(pageInfoSpan.text.trim()) as RegExpExecArray)[1]) : 1;
            return new Array(totalPageNumber).fill(null).map((_, idx) => getPage(idx + 1));
        }
    });
    const scrapNode4 = new ScrapPagePipelineNode({
        previousNode: new TaskNode({previousNode: extractorNode3}, listOfURLList => {
            return listOfURLList.reduce((resultList, urlList) => [...resultList, ...urlList], []);
        }),
    });
    const opt = await scrapNode4.getOutput();
}

main();