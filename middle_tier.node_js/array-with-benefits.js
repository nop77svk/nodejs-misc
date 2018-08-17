function canonicalizeOrderByCriteria(by) {
  if ((typeof by === 'object' && !Array.isArray(by)) || typeof by === 'string' || typeof by === 'number') return canonicalizeOrderByCriteria([by]);

  const result = [];
  for (let i = 0; i < by.length; i++) {
    const fieldDef = by[i];
    const fieldDefType = typeof fieldDef;
    let fieldName;
    let fieldOrder;

    if (fieldDefType === 'string' || fieldDefType === 'number') {
      fieldName = fieldDef;
      fieldOrder = 1;
    } else if (fieldDefType === 'object') {
      if ('name' in fieldDef) {
        fieldName = fieldDef.name;
      } else {
        throw new Error(`ArrayWithBenefits#canonicalizeOrderByCriteria() error on by[${i}]: field definition does not containt attribute "name"`);
      }

      if ('order' in fieldDef) {
        fieldOrder = fieldDef.order;
        if (fieldOrder === 'asc' || fieldOrder === 'ascending' || fieldOrder > 0) {
          fieldOrder = 1;
        } else if (fieldOrder === 'desc' || fieldOrder === 'descending' || fieldOrder < 0) {
          fieldOrder = -1;
        } else {
          throw new Error(`ArrayWithBenefits#canonicalizeOrderByCriteria() error on by[${i}]: field order "${fieldOrder}" is invalid`);
        }
      } else {
        fieldOrder = 1;
      }
    }

    result.push({ name: fieldName, order: fieldOrder });
  }
  return result;
}

function levelOneCompareObject(a, b, canonicalBy) {
  let result = 0;
  for (let i = 0; i < canonicalBy.length; i++) {
    const fieldName = canonicalBy[i].name;
    const fieldOrder = canonicalBy[i].order;

    const aField = a[fieldName];
    if (aField === undefined) throw new Error(`ArrayWithBenefits#levelOneCompareObject() error on "${fieldName}": cannot read attribute "${fieldName}" from object "a"`);
    const bField = b[fieldName];
    if (bField === undefined) throw new Error(`ArrayWithBenefits#levelOneCompareObject() error on "${fieldName}": cannot read attribute "${fieldName}" from object "b"`);

    const fieldTypeA = typeof aField;
    const fieldTypeB = typeof bField;
    if (fieldTypeA !== fieldTypeB) throw new Error(`ArrayWithBenefits#levelOneCompareObject() error on "${fieldName}": cannot compare different data types`);

    switch (fieldTypeA) {
      case 'number': result = fieldOrder * (aField - bField); break;
      case 'string': result = fieldOrder * aField.localeCompare(bField); break;
      default: throw new Error(`ArrayWithBenefits#levelOneCompareObject() error on "${fieldName}": don't know how to compare values of the "${fieldTypeA}" data type`);
    }

    if (result !== 0) {
      break;
    }
  }
  return result;
}

module.exports = class ArrayWithBenefits extends Array {
  /**
   * Equivalent to Array.push(), but returns the array reference for subsequent method chaining.
   * @param {*} element The element to be appended at the end of the array
   * @returns {*} "this" reference
   */
  chainedPush(element) {
    this.push(element);
    return this;
  }

  /**
   * Equivalent to Array.map(), but remaps the array elements in place.
   * @param {*} callback The remapper callback function
   * @returns {*} "this" reference
   */
  mapInPlace(callback) {
    if (callback) {
      /* eslint no-plusplus: ["error", { "allowForLoopAfterthoughts": true }] */
      for (let i = 0; i < this.length; i++) this[i] = callback(this[i]);
    }
    return this;
  }

  /**
   * Equivalent to Array.sort(), but instead of a comparison callback it accepts an array of object
   * attribute names to sort by.
   * @param {*} by List (array) of (string) identifiers of the sort keys.
   * @returns {*} Sorted array
   */
  sortBy(by) {
    let result;
    const canonicalBy = canonicalizeOrderByCriteria(by);
    if (canonicalBy.length === 0) {
      result = 0;
    } else {
      result = this.sort((a, b) => levelOneCompareObject(a, b, canonicalBy));
    }
    return result;
  }

  /**
   * Enhancement to Array.reduce(), equivalent to SQL's GROUP BY with COLLECT() aggregation
   * function. The input array *must be sorted* by the aggregation keys prior to calling
   * this method.
   * @param {*} to Resulting object's attribute name for holding the aggregated (collected) array
   *               of (non-aggregate-key) attributes.
   * @param {*} by List (array) of (string) identifiers of the aggregation keys. If empty,
   *               then the whole input gets "aggregated" into a single-element array
   *               of single-attribute object of the input array. All identifiers must be unique
   *               within the list; no check is performed in this regard, redundancies thus may
   *               cause issues.
   * @returns {*} Reference to the aggregated data as an ArrayWithBenefits object
   */
  aggregate(to, by, isSorted = false) {
    const canonicalBy = canonicalizeOrderByCriteria(by);

    if (canonicalBy.length === 0) {
      const result = {};
      result[to] = [this];
      return result;
    }

    for (let i = 0; i < canonicalBy.length; i++) {
      const fieldName = canonicalBy[i].name;
      if (typeof fieldName !== 'string' || fieldName === '') throw new Error(`.aggregate() error: by[${i}] must be a non-empty string`);
    }

    function auxCreateAggregate(rec) {
      const keysAndDetail = {};
      const aggregates = rec;
      for (let i = 0; i < canonicalBy.length; i++) {
        const fieldName = canonicalBy[i].name;
        keysAndDetail[fieldName] = aggregates[fieldName];
        delete aggregates[fieldName];
      }
      keysAndDetail[to] = [aggregates];
      return keysAndDetail;
    }

    function auxAggregator(inAggr, inCurrent, inIndex) {
      const isEmptyCurrent = inCurrent === null || inCurrent === undefined;
      if (isEmptyCurrent) {
        return inAggr;
      }
      const result = inAggr;

      // each input collection element must be an object
      if (typeof inCurrent !== 'object') throw new Error(`.aggregate() error on element #${inIndex}: inCurrent must be object`);

      // each element on input must contain the aggregation keys
      for (let i = 0; i < canonicalBy.length; i++) {
        const fieldName = canonicalBy[i].name;
        if (!(fieldName in inCurrent)) throw new Error(`.aggregate() error on element #${inIndex}: inCurrent lacks attribute "${fieldName}"`);
      }

      // construct the "record to be compared to" from either "aggr" and "current" inputs
      const currentAggregate = auxCreateAggregate(inCurrent);
      if (inIndex === 0) {
        result.push(currentAggregate);
      } else {
        const lastAggregate = inAggr[inAggr.length - 1];

        // is current record's aggregation key equal to the previous record's aggregation key?
        const compareKeyToPrevious = levelOneCompareObject(currentAggregate, lastAggregate, canonicalBy);

        // either create a new aggregation group, or append the detail to the previous group
        if (compareKeyToPrevious === 0) {
          lastAggregate[to].push(currentAggregate[to][0]);
        } else {
          result.push(currentAggregate);
        }
      }

      return result;
    }

    let result;
    if (isSorted) {
      result = this.reduce(auxAggregator, new ArrayWithBenefits());
    } else {
      result = this.sortBy(canonicalBy).reduce(auxAggregator, new ArrayWithBenefits());
    }
    return result;
  }
};
