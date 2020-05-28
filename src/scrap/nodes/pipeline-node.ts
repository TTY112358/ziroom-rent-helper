import {Task} from "../tools/task";

export type PipelineNodeInput<T> = {
    name?: string,
    previousNode?: PipelineNode<any, T>,
    input?: T,
    inputPromise?: Promise<T>,
};

export abstract class PipelineNode<TIn = any, TOut = any> {
    static nodeCounter: number = 0;
    name: string;
    previousNode: null | PipelineNode<any, TIn>;
    input: null | TIn;
    inputPromise: null | Promise<TIn>;
    nextNodes: PipelineNode<TOut>[];
    task: Task<TOut>;
    result: TOut | null;

    protected constructor(props: PipelineNodeInput<TIn>) {
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
        this.task = this.getNodeTask();
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
        } else {
            try {
                this.result = await this.task;
                return this.result;
            } catch (e) {
                console.error(e);
                throw e;
            }
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

    abstract getNodeTask(): Task<TOut> ;

    async run(): Promise<void> {
        if (!this.result) {
            this.task.start();
            this.result = await this.task;
        }
    }

    async getReorderFunction(): Promise<(arr: []) => []> {
        if (this.previousNode) {
            return this.previousNode.getReorderFunction();
        } else {
            return (arr) => {
                return [...arr];
            };
        }
    }
}