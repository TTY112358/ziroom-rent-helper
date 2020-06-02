import {PipelineNode} from "../nodes/pipeline-node";

type TaskStatus = 'created' | 'pending' | 'fullfilled' | 'rejected';
type Executor<T> = (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void;

export class Task<T> extends Promise<T> {
    status: TaskStatus;
    result: T | null;
    // @ts-ignore
    _resolve;
    // @ts-ignore
    _reject;
    protected executor: Executor<T>;
    protected promise: Promise<T> | null;

    constructor(executor: Executor<T>) {
        let _resolve, _reject;
        super((resolve, reject) => {
            _resolve = resolve;
            _reject = reject;
        });
        this._resolve = _resolve;
        this._reject = _reject;
        this.executor = executor;
        this.promise = null;
        this.status = "created";
        this.result = null;
    }

    get started(): boolean {
        return this.status !== "created";
    }

    get fullfilled(): boolean {
        return this.status === "fullfilled";
    }

    get rejected(): boolean {
        return this.status === "rejected";
    }

    get pending(): boolean {
        return this.status === "pending";
    }

    get finished(): boolean {
        return this.status === "fullfilled" || this.status === "rejected";
    }

    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => (PromiseLike<TResult1> | TResult1)) | undefined | null, onrejected?: ((reason: any) => (PromiseLike<TResult2> | TResult2)) | undefined | null): Promise<TResult1 | TResult2> {
        this.ensureStarted();
        return (this.promise as Promise<T>).then(onfulfilled, onrejected);
    }

    catch<TResult = never>(onrejected?: ((reason: any) => (PromiseLike<TResult> | TResult)) | undefined | null): Promise<T | TResult> {
        this.ensureStarted();
        return (this.promise as Promise<T>).catch(onrejected);
    }

    getInternalPromise() {
        this.status = "pending";
        return new Promise(this.executor).then(data => {
            this.status = "fullfilled";
            this.result = data;
            this._resolve(data);
            return data;
        }, reason => {
            this.status = "rejected";
            this._reject(reason);
            throw reason;
        });
    }

    start() {
        this.promise = this.getInternalPromise();
    }

    ensureStarted() {
        if (!this.promise) {
            this.start();
        }
    }
}

export class NodeTask<T> extends Task<T> {
    sequenceInfo: number[];
    protected currentNode: PipelineNode;
    protected historyNodes: PipelineNode[];

    constructor(props: Executor<T>, currentNode: PipelineNode, previousTask: NodeTask<any> | null = null, sequence: number = 0) {
        super(props);
        this.historyNodes = [...(previousTask?.historyNodes || []), currentNode];
        this.sequenceInfo = [...(previousTask?.sequenceInfo || []), sequence];
        this.currentNode = currentNode;
    }
}