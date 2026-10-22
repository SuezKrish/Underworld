// Character-level LCS preserves unchanged phrases between separate edits.
// Bound the table for unusually long, wholly rewritten documents.
export function revisionDiffSegments(before, after) {
    const a = Array.from(before), b = Array.from(after);
    let first = 0, last = 0;
    while (first < a.length && first < b.length && a[first] === b[first])
        first++;
    while (last < a.length - first && last < b.length - first && a[a.length - 1 - last] === b[b.length - 1 - last])
        last++;
    const x = a.slice(first, a.length - last), y = b.slice(first, b.length - last), out = [];
    const add = (kind, text) => {
        if (!text)
            return;
        if (out.at(-1)?.kind === kind)
            out.at(-1).text += text;
        else
            out.push({ kind, text });
    };
    add('equal', a.slice(0, first).join(''));
    if (x.length * y.length > 4000000) {
        // Large rewrites align by complete lines first, then diff each changed line.
        const left = x.join('').split('\n'), right = y.join('').split('\n');
        if (left.length === right.length && left.length > 1) {
            for (let i = 0; i < left.length; i++) {
                if (i)
                    add('equal', '\n');
                for (const s of revisionDiffSegments(left[i], right[i]))
                    add(s.kind, s.text);
            }
        }
        else {
            add('delete', x.join(''));
            add('insert', y.join(''));
        }
    }
    else {
        const width = y.length + 1, table = new Uint32Array((x.length + 1) * width);
        for (let i = x.length - 1; i >= 0; i--)
            for (let j = y.length - 1; j >= 0; j--)
                table[i * width + j] = x[i] === y[j] ? 1 + table[(i + 1) * width + j + 1] : Math.max(table[(i + 1) * width + j], table[i * width + j + 1]);
        let i = 0, j = 0;
        while (i < x.length || j < y.length) {
            if (i < x.length && j < y.length && x[i] === y[j]) {
                add('equal', x[i++]);
                j++;
            }
            else if (i < x.length && (j === y.length || table[(i + 1) * width + j] >= table[i * width + j + 1]))
                add('delete', x[i++]);
            else
                add('insert', y[j++]);
        }
    }
    add('equal', last ? a.slice(-last).join('') : '');
    return out;
}
