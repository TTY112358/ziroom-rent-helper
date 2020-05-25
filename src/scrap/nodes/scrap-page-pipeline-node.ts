import {ParallelTaskNode} from "./parallel-task-node";
import superAgent from "superagent";
import request from "superagent";
import {PipelineNodeInput} from "./pipeline-node";
import {pageCache} from "../tools/page-cache";
import parse, {HTMLElement} from "node-html-parser";

type SuperAgentAgent = request.SuperAgentStatic & request.Request;


type ScrapPagePipelineNodeResult = { url: string, content: string, document: HTMLElement };


export class ScrapPagePipelineNode extends ParallelTaskNode<string, ScrapPagePipelineNodeResult> {
    static defaultAgent: SuperAgentAgent = superAgent.agent();
    agent: SuperAgentAgent;

    constructor(props: PipelineNodeInput<string[]>) {
        super(props, async url => {
            const text = (await pageCache.getCachedPage(url)) ?? (pageCache.cachePage(url, (await this.agent.get(url)).text));
            return {url, content: text, document: parse(text) as HTMLElement};
        });
        this.agent = ScrapPagePipelineNode.defaultAgent;
    }

    useAgent(agent: SuperAgentAgent): this {
        this.agent = agent;
        return this;
    }
}