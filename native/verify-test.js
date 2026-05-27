const { searchFiles } = require('./index');

console.log('Testing native search...');
const results = searchFiles({
    pattern: 'searchFiles',
    rootPath: '.',
    ignoreCase: false
});

console.log('Found matches:', results.length);
if (results.length > 0) {
    console.log('First match:', results[0]);
    console.log('Verification PASSED ✅');
} else {
    console.log('No matches found. Verification FAILED ❌');
}
