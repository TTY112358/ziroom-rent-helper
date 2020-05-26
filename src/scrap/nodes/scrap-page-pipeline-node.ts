import {ParallelTaskNode} from "./parallel-task-node";
import superAgent from "superagent";
import request from "superagent";
import {PipelineNodeInput} from "./pipeline-node";
import {pageCache} from "../tools/page-cache";
import parse, {HTMLElement} from "node-html-parser";

type SuperAgentAgent = request.SuperAgentStatic & request.Request;

export type ScrapPagePipelineNodeResult = { url: string, content: string, document: HTMLElement };

export class ScrapPagePipelineNode extends ParallelTaskNode<string, ScrapPagePipelineNodeResult> {
    static defaultAgent: SuperAgentAgent = superAgent.agent();
    agent: SuperAgentAgent;
    private readonly useCache: boolean;

    constructor(props: PipelineNodeInput<string[]>, useCache: boolean = true) {
        super(props, async url => {
            const cachedPage = this.useCache ? (await pageCache.getCachedPage(url)) : null;
            const text = cachedPage ?? (pageCache.cachePage(url, (await this.agent.get(url)).text));
            return {url, content: text, document: parse(text) as HTMLElement};
        });
        this.agent = ScrapPagePipelineNode.defaultAgent;
        this.useCache = useCache;
    }

    useAgent(agent: SuperAgentAgent): this {
        this.agent = agent;
        return this;
    }
}