import {PipelineNode, PipelineNodeInput} from "./pipeline-node";

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