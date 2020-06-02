import {NodeTask} from "../tools/task";

export type PipelineNodeInput<T> = {
    name?: string,
    previousNode?: PipelineNode<any, T>,
    input?: T,
    inputPromise?: Promise<T>,
};

export type ParalleledOutputNodeInput<T> = PipelineNodeInput<T[]> & {
    inputPromises?: Promise<T>[]
};

export abstract class PipelineNode<TIn = any, TOut = any> {
    static nodeCounter: number = 0;
    name: string;
    previousNode: null | PipelineNode<any, TIn>;
    input: null | TIn;
    inputPromise: null | Promise<TIn>;
    nextNodes: PipelineNode<TOut>[];
    task: NodeTask<TOut>;
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

    abstract getNodeTask(): NodeTask<TOut> ;

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

export abstract class ParalleledOutputNode<TIn, TOut> extends PipelineNode<TIn[], TOut[]> {

    inputPromises: Promise<TIn>[] | null;
    protected singleTaskDoneListeners: ((singleTask: NodeTask<TOut>, eleIndex: number) => void)[];
    protected wholeTaskDoneListeners: ((wholeTask: NodeTask<TOut[]>) => void)[];
    tasks: NodeTask<TOut>[];
    emitTasks: Promise<void>[];

    protected constructor(props: ParalleledOutputNodeInput<TIn>) {
        super(props);
        this.inputPromises = null;
        if (!this.previousNode && !this.input && !this.inputPromise && props.inputPromises) {
            this.inputPromises = props.inputPromises;
            this.task = this.getNodeTask();
        }
        this.singleTaskDoneListeners = [];
        this.wholeTaskDoneListeners = [];
        this.tasks = [];
        this.emitTasks = [];
    }

    protected get isPurePipeNode(): boolean {
        return !!(this.inputPromises || this.previousNode && this.previousNode instanceof ParalleledOutputNode);
    }

    onSingleTaskDone(listener: (singleTask: NodeTask<TOut>, eleIndex: number) => void) {
        this.singleTaskDoneListeners.push(listener);
    }

    onWholeTaskDone(listener: (wholeTask: NodeTask<TOut[]>) => void) {
        this.wholeTaskDoneListeners.push(listener);
    }

}