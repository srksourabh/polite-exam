// Edge case tests for hierarchical question features

console.log('=== EDGE CASE TESTS ===\n');

// Test 1: Multiple passages with multiple sub-questions
console.log('Test 6: Multiple Passages');
function getHierarchicalQuestionNumber(questions, questionIndex) {
    const question = questions[questionIndex];
    const isSubQuestion = question['Is Sub Question'] === true;
    const parentQuestionId = question['Parent Question ID'];
    const subQuestionOrder = question['Sub Question Order'];

    if (isSubQuestion && parentQuestionId) {
        const parentIndex = questions.findIndex(q => q.ID === parentQuestionId);
        if (parentIndex !== -1) {
            const parentNum = parentIndex + 1;
            const subOrder = subQuestionOrder || 1;
            return { display: parentNum + '.' + subOrder, isSubQ: true };
        }
    }
    return { display: questionIndex + 1, isSubQ: false };
}

const multiPassageTest = [
    { ID: 'Q1', Question: 'Normal Q1' },
    { ID: 'P1', Question: 'Passage 1 text', 'Option A': '', 'Option B': '' },
    { ID: 'S1', Question: 'Sub 1.1', 'Is Sub Question': true, 'Parent Question ID': 'P1', 'Sub Question Order': 1 },
    { ID: 'S2', Question: 'Sub 1.2', 'Is Sub Question': true, 'Parent Question ID': 'P1', 'Sub Question Order': 2 },
    { ID: 'S3', Question: 'Sub 1.3', 'Is Sub Question': true, 'Parent Question ID': 'P1', 'Sub Question Order': 3 },
    { ID: 'Q2', Question: 'Normal Q2' },
    { ID: 'P2', Question: 'Passage 2 text', 'Option A': '', 'Option B': '' },
    { ID: 'S4', Question: 'Sub 2.1', 'Is Sub Question': true, 'Parent Question ID': 'P2', 'Sub Question Order': 1 },
    { ID: 'S5', Question: 'Sub 2.2', 'Is Sub Question': true, 'Parent Question ID': 'P2', 'Sub Question Order': 2 },
];

const expected = ['1', '2', '2.1', '2.2', '2.3', '6', '7', '7.1', '7.2'];
const results = multiPassageTest.map((_, i) => getHierarchicalQuestionNumber(multiPassageTest, i).display.toString());

let test6Pass = true;
results.forEach((r, i) => {
    const ok = r === expected[i];
    if (!ok) test6Pass = false;
    console.log('  Q' + (i+1) + ': ' + r + ' (expected: ' + expected[i] + ') ' + (ok ? '✅' : '❌'));
});
console.log('Test 6:', test6Pass ? '✅ PASSED' : '❌ FAILED');


// Test 2: Complex scoring with mixed question types
console.log('\nTest 7: Complex Scoring');
function calculateScore(questions, userAnswers) {
    let score = 0;
    let answered = 0;
    let correct = 0;
    let wrong = 0;
    let skipped = 0;

    questions.forEach((question, index) => {
        const isMainPassage = !question['Option A'] && !question['Option B'];
        const userAnswer = userAnswers[index];
        const hasAnswered = typeof userAnswer === 'number' && userAnswer >= 0;
        const isCorrect = userAnswer === question.correctIndex;

        if (!isMainPassage) {
            if (hasAnswered) {
                answered++;
                if (isCorrect) {
                    score += 1;
                    correct++;
                } else {
                    score -= 0.25;
                    wrong++;
                }
            } else {
                skipped++;
            }
        }
    });
    return { score, answered, correct, wrong, skipped };
}

const scoringTest = [
    { ID: 'Q1', 'Option A': 'A', 'Option B': 'B', correctIndex: 0 },  // Correct
    { ID: 'P1', 'Option A': '', 'Option B': '' },                      // Passage (skip)
    { ID: 'S1', 'Option A': 'A', 'Option B': 'B', correctIndex: 1 },  // Wrong
    { ID: 'S2', 'Option A': 'A', 'Option B': 'B', correctIndex: 0 },  // Correct
    { ID: 'S3', 'Option A': 'A', 'Option B': 'B', correctIndex: 2 },  // Skipped
    { ID: 'Q2', 'Option A': 'A', 'Option B': 'B', correctIndex: 1 },  // Wrong
];

const answers = [0, 0, 0, 0, null, 0]; // Q1=correct, P1=ignored, S1=wrong, S2=correct, S3=skip, Q2=wrong
const scoreResult = calculateScore(scoringTest, answers);

console.log('  Score:', scoreResult.score, '(expected: 1.5)');  // 2 correct - 2 wrong*0.25 = 2 - 0.5 = 1.5
console.log('  Answered:', scoreResult.answered, '(expected: 4)');
console.log('  Correct:', scoreResult.correct, '(expected: 2)');
console.log('  Wrong:', scoreResult.wrong, '(expected: 2)');
console.log('  Skipped:', scoreResult.skipped, '(expected: 1)');

const test7Pass = scoreResult.score === 1.5 &&
                  scoreResult.answered === 4 &&
                  scoreResult.correct === 2 &&
                  scoreResult.wrong === 2 &&
                  scoreResult.skipped === 1;
console.log('Test 7:', test7Pass ? '✅ PASSED' : '❌ FAILED');


// Test 3: Orphan sub-question handling
console.log('\nTest 8: Orphan Sub-Question Handling');
const orphanTest = [
    { ID: 'Q1', Question: 'Normal Q1' },
    { ID: 'S1', Question: 'Orphan sub', 'Is Sub Question': true, 'Parent Question ID': 'NONEXISTENT', 'Sub Question Order': 1 },
];

const orphanResult = getHierarchicalQuestionNumber(orphanTest, 1);
console.log('  Orphan sub-question display:', orphanResult.display, '(expected: 2 - falls back to index)');
const test8Pass = orphanResult.display === 2 && orphanResult.isSubQ === false;
console.log('Test 8:', test8Pass ? '✅ PASSED' : '❌ FAILED');


// Test 4: Empty options vs missing options
console.log('\nTest 9: Empty vs Missing Options');
function isPassage(q) {
    return !q['Option A'] && !q['Option B'] && q.Question;
}

const emptyOptions = { Question: 'Text', 'Option A': '', 'Option B': '' };
const missingOptions = { Question: 'Text' };
const nullOptions = { Question: 'Text', 'Option A': null, 'Option B': null };
const hasOptions = { Question: 'Text', 'Option A': 'A', 'Option B': 'B' };

console.log('  Empty options (passage):', !!isPassage(emptyOptions), '(expected: true)');
console.log('  Missing options (passage):', !!isPassage(missingOptions), '(expected: true)');
console.log('  Null options (passage):', !!isPassage(nullOptions), '(expected: true)');
console.log('  Has options (normal):', !!isPassage(hasOptions), '(expected: false)');

const test9Pass = !!isPassage(emptyOptions) === true &&
                  !!isPassage(missingOptions) === true &&
                  !!isPassage(nullOptions) === true &&
                  !!isPassage(hasOptions) === false;
console.log('Test 9:', test9Pass ? '✅ PASSED' : '❌ FAILED');


// Test 5: Sub-question order edge cases
console.log('\nTest 10: Sub-Question Order Edge Cases');
const orderTest = [
    { ID: 'P1', Question: 'Passage', 'Option A': '', 'Option B': '' },
    { ID: 'S1', 'Is Sub Question': true, 'Parent Question ID': 'P1', 'Sub Question Order': 0 }, // Order 0
    { ID: 'S2', 'Is Sub Question': true, 'Parent Question ID': 'P1', 'Sub Question Order': undefined }, // undefined
    { ID: 'S3', 'Is Sub Question': true, 'Parent Question ID': 'P1', 'Sub Question Order': 5 }, // Gap in order
];

const orderResults = orderTest.map((_, i) => getHierarchicalQuestionNumber(orderTest, i).display.toString());
console.log('  Order 0:', orderResults[1], '(expected: 1.1 - 0 is falsy, defaults to 1)');
console.log('  Undefined order:', orderResults[2], '(expected: 1.1 - defaults to 1)');
console.log('  Gap in order (5):', orderResults[3], '(expected: 1.5)');

// Note: Order 0 and undefined both default to 1, which is expected behavior
const test10Pass = orderResults[1] === '1.1' &&
                   orderResults[2] === '1.1' &&
                   orderResults[3] === '1.5';
console.log('Test 10:', test10Pass ? '✅ PASSED' : '❌ FAILED');


// Summary
console.log('\n========================================');
console.log('       EDGE CASE TEST SUMMARY');
console.log('========================================');
console.log('Test 6 (Multiple Passages):', test6Pass ? '✅' : '❌');
console.log('Test 7 (Complex Scoring):', test7Pass ? '✅' : '❌');
console.log('Test 8 (Orphan Handling):', test8Pass ? '✅' : '❌');
console.log('Test 9 (Empty vs Missing):', test9Pass ? '✅' : '❌');
console.log('Test 10 (Order Edge Cases):', test10Pass ? '✅' : '❌');

const allPassed = test6Pass && test7Pass && test8Pass && test9Pass && test10Pass;
console.log('----------------------------------------');
console.log('EDGE CASES:', allPassed ? '✅ ALL PASSED' : '❌ SOME FAILED');
console.log('========================================\n');

process.exit(allPassed ? 0 : 1);
