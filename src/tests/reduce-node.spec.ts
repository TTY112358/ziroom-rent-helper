import {ParallelTaskNode} from "../scrap/nodes/parallel-task-node";
import {ReduceNode} from "../scrap/nodes/reduce-node";

async function sleep(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

test("order-by-reorder-function", async done => {
    let parallelNode: ParallelTaskNode<string, string[]>, reduceNode: ReduceNode<string> | undefined;
    for (let i = 0; i < 4; i++) {
        const props: { input: string[] } | { previousNode: any } = reduceNode ? {previousNode: reduceNode} : {input: ["1", "2", "3"]};
        parallelNode = new ParallelTaskNode(props, async (c) => {
            const sleepTime = Math.floor(Math.random() * 500);
            const generateCount = Math.floor(Math.random() * 10 + 1);
            await sleep(sleepTime);
            return new Array(generateCount).fill(null).map((a, aIndex) => `${c}${aIndex}`);
        });
        reduceNode = new ReduceNode({previousNode: parallelNode});
    }

    if (reduceNode) {
        const output = await reduceNode.getOutput();
        const orderedOutput = (await reduceNode.getReorderFunction())(output as []);
        const correctOrderedOutput = output.sort();
        expect(orderedOutput).toEqual(correctOrderedOutput);
        done();
    }
});
test("order-by-sequence", async done => {
    let parallelNode: ParallelTaskNode<string, string[]>, reduceNode: ReduceNode<string> | undefined;
    for (let i = 0; i < 4; i++) {
        const props: { input: string[] } | { previousNode: any } = reduceNode ? {previousNode: reduceNode} : {input: ["1", "2", "3"]};
        parallelNode = new ParallelTaskNode(props, async (c) => {
            const sleepTime = Math.floor(Math.random() * 500);
            const generateCount = Math.floor(Math.random() * 10 + 1);
            await sleep(sleepTime);
            return new Array(generateCount).fill(null).map((a, aIndex) => `${c}${aIndex}`);
        });
        reduceNode = new ReduceNode({previousNode: parallelNode});
    }

    if (reduceNode) {
        const output = await reduceNode.getOutput();
        const tasksOutput = await Promise.all(reduceNode.tasks.sort((a, b) => {
            const aHistory = a.sequenceInfo;
            const bHistory = b.sequenceInfo;
            const len = aHistory.length;
            for (let i = 0; i < len; i++) {
                if (aHistory[i] < bHistory[i]) {
                    return -1;
                } else if (aHistory[i] > bHistory[i]) {
                    return 1;
                }
            }
            return 0;
        }));
        const correctOrderedOutput = output.sort();
        expect(tasksOutput).toEqual(correctOrderedOutput);
        done();
    }
});