const remRegex = require("./lib/rem-unit-regex");
const filterPropList = require("./lib/filter-prop-list");

const defaults = {
  rootValue: 16,
  unitPrecision: 5,
  selectorBlackList: [],
  propList: ["font", "font-size", "line-height", "letter-spacing"],
  replace: true,
  mediaQuery: false,
  minRemValue: 0,
};

module.exports = (options = {}) => {
  const opts = Object.assign({}, defaults, options);
  const satisfyPropList = createPropListMatcher(opts.propList);
  let remReplace;

  return {
    postcssPlugin: "postcss-rem-to-pixel",
    Once() {
      remReplace = createRemReplace(
        opts.rootValue,
        opts.unitPrecision,
        opts.minRemValue,
      );
    },
    Declaration(decl) {
      // This should be the fastest test and will remove most declarations
      if (decl.value.indexOf("rem") === -1) return;

      if (!satisfyPropList(decl.prop)) return;

      if (blacklistedSelector(opts.selectorBlackList, decl.parent.selector))
        return;

      const value = decl.value.replace(remRegex, remReplace);

      // if px unit already exists, do not add or replace
      if (declarationExists(decl.parent, decl.prop, value)) return;

      if (opts.replace) {
        decl.value = value;
      } else {
        decl.cloneAfter({ value: value });
      }
    },
    AtRule(atRule) {
      if (opts.mediaQuery && atRule.name === "media") {
        if (atRule.params.indexOf("rem") === -1) return;
        atRule.params = atRule.params.replace(remRegex, remReplace);
      }
    },
  };
};

module.exports.postcss = true;

function createRemReplace(rootValue, unitPrecision, minRemValue) {
  return function (m, $1) {
    if (!$1) return m;
    const rems = parseFloat($1);
    if (rems < minRemValue) return m;
    const fixedVal = toFixed(rems * rootValue, unitPrecision);
    return fixedVal === 0 ? "0" : fixedVal + "px";
  };
}

function toFixed(number, precision) {
  const multiplier = Math.pow(10, precision + 1),
    wholeNumber = Math.floor(number * multiplier);
  return (Math.round(wholeNumber / 10) * 10) / multiplier;
}

function declarationExists(decls, prop, value) {
  return decls.some(function (decl) {
    return decl.prop === prop && decl.value === value;
  });
}

function blacklistedSelector(blacklist, selector) {
  if (typeof selector !== "string") return;
  return blacklist.some(function (regex) {
    if (typeof regex === "string") return selector.indexOf(regex) !== -1;
    return selector.match(regex);
  });
}

function createPropListMatcher(propList) {
  const hasWild = propList.indexOf("*") > -1;
  const matchAll = hasWild && propList.length === 1;
  const lists = {
    exact: filterPropList.exact(propList),
    contain: filterPropList.contain(propList),
    startWith: filterPropList.startWith(propList),
    endWith: filterPropList.endWith(propList),
    notExact: filterPropList.notExact(propList),
    notContain: filterPropList.notContain(propList),
    notStartWith: filterPropList.notStartWith(propList),
    notEndWith: filterPropList.notEndWith(propList),
  };
  return function (prop) {
    if (matchAll) return true;
    return (
      (hasWild ||
        lists.exact.indexOf(prop) > -1 ||
        lists.contain.some(function (m) {
          return prop.indexOf(m) > -1;
        }) ||
        lists.startWith.some(function (m) {
          return prop.indexOf(m) === 0;
        }) ||
        lists.endWith.some(function (m) {
          return prop.indexOf(m) === prop.length - m.length;
        })) &&
      !(
        lists.notExact.indexOf(prop) > -1 ||
        lists.notContain.some(function (m) {
          return prop.indexOf(m) > -1;
        }) ||
        lists.notStartWith.some(function (m) {
          return prop.indexOf(m) === 0;
        }) ||
        lists.notEndWith.some(function (m) {
          return prop.indexOf(m) === prop.length - m.length;
        })
      )
    );
  };
}
