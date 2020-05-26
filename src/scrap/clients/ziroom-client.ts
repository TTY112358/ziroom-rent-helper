import superAgent from "superagent";
import {HTMLElement} from "node-html-parser";
// @ts-ignore
import Throttle from 'superagent-throttle';
import {TaskNode} from "../nodes/task-node";
import {ScrapPagePipelineNode, ScrapPagePipelineNodeResult} from "../nodes/scrap-page-pipeline-node";
import {ParallelTaskNode} from "../nodes/parallel-task-node";
import {Task} from "../tools/task";


async function main() {
    ScrapPagePipelineNode.defaultAgent = superAgent.agent().use(new Throttle({
        rate: 5,
        ratePer: 1000,
        concurrent: 5,
    }).plugin());
    const tailNode = new ScrapPagePipelineNode({
        input: [
            "http://sh.ziroom.com/z/",
        ]
    }).chainNextNode<ScrapPagePipelineNodeResult>(
        new TaskNode({}, ([r]) => r)
    ).chainNextNode<{ url: string, district: string }[]>(
        new TaskNode({}, ele => {
            const liElement = ele.document.querySelectorAll("div.Z_filter ul li.f-item").find(e => e.querySelector("strong.title").text.trim() === '找房方式') as HTMLElement;
            const optDivElement = liElement.querySelectorAll("div.opt-type").find(e => e.querySelector(".opt-name").text.trim() === '区域') as HTMLElement;
            const aElements = optDivElement.querySelectorAll("div.child-opt div.wrapper a.item");
            return aElements.map(a => ({url: `http:${a.getAttribute("href")}`, district: a.text.trim()}));
        })
    ).chainNextNode<string[]>(
        new ParallelTaskNode({}, (e) => e.url)
    ).chainNextNode<ScrapPagePipelineNodeResult[]>(
        new ScrapPagePipelineNode({})
    ).chainNextNode<{ url: string, subDistrict: string }[][]>(
        new ParallelTaskNode({}, ele => {
            const liElement = ele.document.querySelectorAll("div.Z_filter ul li.f-item").find(e => e.querySelector("strong.title").text.trim() === '找房方式') as HTMLElement;
            const optDivElement = liElement.querySelectorAll("div.opt-type").find(e => e.querySelector(".opt-name").text.trim() === '区域') as HTMLElement;
            const aElements = optDivElement.querySelectorAll("div.grand-child-opt a.checkbox");
            return aElements.map(a => ({url: `http:${a.getAttribute("href")}`, subDistrict: a.text.trim()}));
        })
    ).chainNextNode<{ url: string, subDistrict: string }[]>(
        new TaskNode({}, listOfURLList => {
            return listOfURLList.reduce((resultList, urlList) => [...resultList, ...urlList], []);
        })
    ).chainNextNode<string[]>(
        new ParallelTaskNode<{ url: string, subDistrict: string }, string>({}, e => e.url)
    ).chainNextNode<ScrapPagePipelineNodeResult[]>(
        new ScrapPagePipelineNode({}, false)
    ).chainNextNode<string[][]>(
        new ParallelTaskNode({}, ele => {
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
        })
    ).chainNextNode<string[]>(
        new TaskNode({}, listOfURLList => {
            return listOfURLList.reduce((resultList, urlList) => [...resultList, ...urlList], []);
        })
    ).chainNextNode<ScrapPagePipelineNodeResult[]>(
        new ScrapPagePipelineNode({})
    );
    const opt = await tailNode.getOutput();
    console.log(opt);
}

main();

