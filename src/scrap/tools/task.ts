type TaskStatus = 'created' | 'pending' | 'fullfilled' | 'rejected';

export class Task<T> extends Promise<T> {
    status: TaskStatus;
    result: T | null;
    protected executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void;
    protected promise: Promise<T> | null;

    constructor(executor: (resolve: (value?: T | PromiseLike<T>) => void, reject: (reason?: any) => void) => void) {
        super((resolve) => resolve());
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
            return data;
        }, reason => {
            this.status = "rejected"
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