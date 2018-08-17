# node.js server-side snippets

## ArrayWithBenefits

Extension to the Array class (rather than a direct enhancement of the Array prototype) with a few added methods:
* aggregate() = special .reduce() on arrays of objects; JS implementation of SQL's GROUP BY with COLLECT() aggregation function; the grouping criteria is a list of attribute names from the actual array
* sortBy() = .sort() on arrays of objects; instead of writing your own callback use a list of attribute names from the actual array as the ordering criteria definition 
* chainedPush() = .push() that returns the modified array, so that the result can further be chained
* mapInPlace() = .map() that maps the elements in place instead of returning a new array

You can either use it as a class override or you can use it as an enhancement of the Array.prototype. (The latter, I could not. ESLint prevented me from doing that.) Feel free to modify the code according to your needs.
