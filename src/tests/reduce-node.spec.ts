import {ParallelTaskNode} from "../scrap/nodes/parallel-task-node";
import {ReduceNode} from "../scrap/nodes/reduce-node";

async function sleep(time: number) {
    return new Promise(resolve => setTimeout(resolve, time));
}

test("reduce-order", async done => {
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