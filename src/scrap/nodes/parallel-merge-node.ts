import {ParallelTaskNode} from "./parallel-task-node";
import {ParalleledOutputNode, ParalleledOutputNodeInput, PipelineNode} from "./pipeline-node";
import {NodeTask} from "../tools/task";

namespace ParallelMergeNode {
    export type Props<TInTuple> = { name?: string, sources: { [K in keyof TInTuple]: Omit<ParalleledOutputNodeInput<TInTuple[K]>, 'name'> } };
    export type Sources<T> = {
        previousNode: null | PipelineNode<any, T[]>;
        input: null | T[];
        inputPromise: null | Promise<T[]>;
        inputPromises: null | Promise<T>[];
        parallelled: boolean,
    };
}

export class ParallelMergeNode<TInTuple extends any[], TOut = any> extends ParallelTaskNode<TInTuple, TOut> {

    protected sources: ParallelMergeNode.Sources<TInTuple[keyof TInTuple]>[];

    constructor(props: ParallelMergeNode.Props<TInTuple>, taskFunc: (a: TInTuple) => TOut | Promise<TOut>) {
        super(props, taskFunc);
        this.sources = props.sources.map(source => ({
            previousNode: source.previousNode || null,
            input: source.input || null,
            inputPromise: source.inputPromise || null,
            inputPromises: source.inputPromises || null,
            parallelled: ParallelMergeNode.getParalleledOfSource(source),
        }));
        return this;
    }

    protected get isPurePipeNode(): boolean {
        return this.sources.every(source => source.parallelled);
    }

    private static getParalleledOfSource<T>(source: Omit<ParalleledOutputNodeInput<T>, 'name'>) {
        return !!(source.inputPromises || source.previousNode && source.previousNode instanceof ParallelTaskNode);
    }

    async getInput(): Promise<TInTuple[]> {
        throw new Error("getInput not allowed for parallel merge node");
    }

    getNodeTask(): NodeTask<TOut[]> {
        return new NodeTask<TOut[]>(async resolve => {
            const sourceNum = this.sources.length;
            const dataMatrix: (TInTuple[number] | undefined)[][] = new Array(sourceNum).fill(null).map(() => []);
            const taskEmitResolvers: [((a: TOut) => void), () => void][] = [];
            const sourcesDone: boolean[] = new Array(sourceNum).fill(false);
            const checkAllSourcesOKAndDoAt = async (index: number) => {
                const dataColumn = dataMatrix.map(dataRow => dataRow[index]);
                if (!this.tasks[index]) {
                    let taskResolveFunc: ((a: TOut) => void), emitResolveFunc: () => void;
                    this.tasks[index] = new NodeTask<TOut>(resolve1 => taskResolveFunc = resolve1, this, null, index);
                    this.tasks[index].ensureStarted();
                    this.emitTasks[index] = new Promise<void>(resolve1 => emitResolveFunc = resolve1);
                    // @ts-ignore
                    taskEmitResolvers[index] = [taskResolveFunc, emitResolveFunc];
                }
                if (dataColumn.every(data => data !== undefined)) {
                    const result = await this.taskFunc(dataColumn as TInTuple);
                    taskEmitResolvers[index][0](result);
                    setImmediate(() => {
                        this.singleTaskDoneListeners.forEach(l => l(this.tasks[index], index));
                        taskEmitResolvers[index][1]();
                    });
                }
            };

            const getPromiseOfAllSources = () => {
                return Promise.all(this.sources.map((source, index) => {
                    if (source.input) {
                        return source.input;
                    } else if (source.inputPromise) {
                        return source.inputPromise;
                    } else if (source.inputPromises) {
                        return Promise.all(source.inputPromises);
                    } else if (source.previousNode) {
                        return source.previousNode.task;
                    } else {
                        throw new Error(`no input for source ${index}`);
                    }
                }));
            };

            let triggered = false;
            const checkAllSourcesOKAndDo = async () => {
                await getPromiseOfAllSources();
                if (sourcesDone.every(a => a) && !triggered) {
                    triggered = true;
                    const result = await Promise.all(this.tasks);
                    await Promise.all(this.emitTasks);
                    setImmediate(() => {
                        this.wholeTaskDoneListeners.forEach(l => l(this.task));
                    });
                    resolve(result);
                }
            }
            for (let i = 0; i < this.sources.length; i++) {
                let source = this.sources[i];
                if (source.input) {
                    for (let j = 0; j < source.input.length; j++) {
                        dataMatrix[i][j] = source.input[j];
                        checkAllSourcesOKAndDoAt(j);
                    }
                    sourcesDone[i] = true;
                    checkAllSourcesOKAndDo();
                } else if (source.inputPromise) {
                    source.inputPromise.then(list => {
                        for (let j = 0; j < list.length; j++) {
                            dataMatrix[i][j] = list[j];
                            checkAllSourcesOKAndDoAt(j);
                        }
                        sourcesDone[i] = true;
                        checkAllSourcesOKAndDo();
                    });
                } else if (source.inputPromises) {
                    for (let j = 0; j < source.inputPromises.length; j++) {
                        source.inputPromises[j].then(ele => {
                            dataMatrix[i][j] = ele;
                            checkAllSourcesOKAndDoAt(j);
                        });
                    }
                    Promise.all(source.inputPromises).then(() => {
                        sourcesDone[i] = true;
                        checkAllSourcesOKAndDo();
                    });
                } else if (source.previousNode) {
                    const previousNode = source.previousNode;
                    if (previousNode instanceof ParalleledOutputNode) {
                        previousNode.onSingleTaskDone(async (task, j) => {
                            dataMatrix[i][j] = await task;
                            checkAllSourcesOKAndDoAt(j);
                        });
                        previousNode.onWholeTaskDone(async (task) => {
                            sourcesDone[i] = true;
                            checkAllSourcesOKAndDo();
                        });
                        previousNode.task.ensureStarted();
                    } else {
                        previousNode.getOutput().then(list => {
                            for (let j = 0; j < list.length; j++) {
                                dataMatrix[i][j] = list[j];
                                checkAllSourcesOKAndDoAt(j);
                            }
                            sourcesDone[i] = true;
                            checkAllSourcesOKAndDo();
                        });
                    }
                } else {
                    throw new Error(`no input for source ${i}`);
                }

            }

        }, this, null);
    }
}
