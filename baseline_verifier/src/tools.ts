/**
 * This computes lhs - rhs
 * @param lhs left-hand side set
 * @param rhs right-hand side set
 */
function subtractSet(lhs: any, rhs: any): [any, any] {
    const subtraction: {
        [attr: string]: any;
    } = {};

    const intersect: {
        [attr: string]: any;
    } = {};

    for (const attr in lhs) {
        if (!lhs.hasOwnProperty(attr)) {
            continue;
        }
        if (!(attr in rhs)) {
            subtraction[attr] = lhs[attr];
        } else {
            intersect[attr] = lhs[attr];
        }
    }

    return [subtraction, intersect];
}

function getDifferences(lhs: any, rhs: any): [any, any, any] {
    const [s1, intersect] = subtractSet(lhs, rhs);
    const [s2] = subtractSet(rhs, lhs);
    return [s1, intersect, s2];
}

function matches(lhs: any, rhs: any): boolean {
    const [s1, , s2] = getDifferences(lhs, rhs);
    return ((Object.keys(s1).length === 0) && (Object.keys(s2).length === 0));
}
export {
    subtractSet,
    getDifferences,
    matches,
};
