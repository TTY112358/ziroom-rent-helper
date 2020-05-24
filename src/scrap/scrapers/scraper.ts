import type request from "superagent";
import superAgent from 'superagent';
import parse, {HTMLElement} from "node-html-parser";
import Events from "events";
import {pageCache} from "../tools/page-cache";

type SuperAgentAgent = request.SuperAgentStatic & request.Request;
type PipelineNodeInput<T> = {
    name?: string,
    previousNode?: PipelineNode<any, T>,
    input?: T,
    inputPromise?: Promise<T>,
};

export class PipelineNode<TIn = any, TOut = any> {
    static nodeCounter: number = 0;
    name: string;
    eventEmitter = new Events.EventEmitter();
    previousNode: null | PipelineNode<any, TIn>;
    input: null | TIn;
    inputPromise: null | Promise<TIn>;
    nextNodes: PipelineNode<TOut>[];
    task: Promise<TOut> | null;
    result: TOut | null;

    constructor(props: PipelineNodeInput<TIn>) {
        if (props.name !== undefined && props.name.length > 0) {
            this.name = name;
        } else {
            this.name = "node-" + PipelineNode.nodeCounter;
            PipelineNode.nodeCounter++;
        }
        const {previousNode, input, inputPromise} = props;
        this.previousNode = null;
        this.input = null;
        this.inputPromise = null;
        if (previousNode) {
            this.previousNode = previousNode;
            if (!previousNode.nextNodes.find(n => n === this)) {
                previousNode.nextNodes.push(this);
            }
        } else if (input) {
            this.input = input;
        } else if (inputPromise) {
            this.inputPromise = inputPromise;
        }
        this.nextNodes = [];
        this.task = null;
        this.result = null;
    }

    async getInput(): Promise<TIn> {
        if (this.previousNode) {
            return this.previousNode.getOutput();
        } else if (this.input) {
            return this.input;
        } else if (this.inputPromise) {
            return this.inputPromise;
        }
        throw new Error("no input for pipeline node");
    }

    async getOutput(): Promise<TOut> {
        if (this.result) {
            return this.result;
        } else if (this.task) {
            this.result = await this.task;
            return this.result;
        } else {
            await this.run();
            return this.result as TOut;
        }
    }

    getPrevious(): PipelineNode<any, TIn> | null {
        return this.previousNode;
    }

    getNext(): PipelineNode<TOut>[] {
        return this.nextNodes;
    }

    setNext(pipelineNodeOrNodes: PipelineNode<TOut> | PipelineNode<TOut>[]): this {
        if (Array.isArray(pipelineNodeOrNodes)) {
            this.nextNodes = [...pipelineNodeOrNodes];
            pipelineNodeOrNodes.forEach(n => n.previousNode = this);
        } else {
            this.nextNodes = [pipelineNodeOrNodes];
            pipelineNodeOrNodes.previousNode = this;
        }
        return this;
    }

    async runInternal(input: TIn): Promise<TOut> {
        throw new Error("not implemented")
    };

    async run(): Promise<void> {
        if (!this.result) {
            const input = await this.getInput();
            this.result = await this.runInternal(input);
        }
    }
}

export class TaskNode<TIn, TOut> extends PipelineNode<TIn, TOut> {
    constructor(props: PipelineNodeInput<TIn>, taskFunc: (a: TIn) => (TOut | Promise<TOut>)) {
        super(props);
        this.runInternal = async (input) => {
            console.info(`${this.name} start`);
            const toReturn = taskFunc(input);
            console.info(`${this.name} done`);
            return toReturn;
        };
    }
}


export class ParallelTaskNode<TIn, TOut> extends PipelineNode<TIn[], TOut[]> {
    inputPromises: Promise<TIn>[] | null;
    taskPromises: Promise<TOut>[] | null;
    runInternalSingle: (a: TIn) => (TOut | Promise<TOut>);

    constructor(props: PipelineNodeInput<TIn[]> & { inputPromises?: Promise<TIn>[], }, taskFunc: (a: TIn) => (TOut | Promise<TOut>)) {
        super(props);
        this.inputPromises = null;
        if (!this.previousNode && !this.input && !this.inputPromise && props.inputPromises) {
            this.inputPromises = props.inputPromises;
        }
        this.taskPromises = null;
        this.runInternalSingle = async (a) => {
            console.info(`${this.name} start single`);
            const toReturn = await taskFunc(a);
            console.info(`${this.name} done single`);
            return toReturn;
        };
    }

    async getTaskPromises(): Promise<Promise<TOut>[]> {
        if (this.taskPromises) {
            return this.taskPromises;
        } else {
            if (this.previousNode && this.previousNode instanceof ParallelTaskNode) {
                this.taskPromises = (await this.previousNode.getTaskPromises()).map(p => p.then(res => this.runInternalSingle(res)));
            } else {
                const input = await this.getInput();
                this.taskPromises = input.map(async e => this.runInternalSingle(e));
            }
            return this.taskPromises;
        }
    }

    async runInternal(input: (TIn | Promise<TIn>)[]): Promise<TOut[]> {
        this.taskPromises = input.map(async e => this.runInternalSingle(await e));
        return Promise.all(this.taskPromises);
    }

    async run(): Promise<void> {
        if (!this.result) {
            const taskPromises = await this.getTaskPromises();
            this.task = Promise.all(taskPromises);
            this.result = await this.task;
        }
    }
}

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