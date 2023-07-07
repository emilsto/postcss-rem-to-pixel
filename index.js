'use strict';

var objectAssign = require('object-assign');
var remRegex = require('./lib/rem-unit-regex');
var filterPropList = require('./lib/filter-prop-list');

var defaults = {
    rootValue: 16,
    unitPrecision: 5,
    selectorBlackList: [],
    propList: ['font', 'font-size', 'line-height', 'letter-spacing'],
    replace: true,
    mediaQuery: false,
    minRemValue: 0
};


const plugin = ('postcss-rem-to-pixel', function (options) {

    var opts = objectAssign({}, defaults, options);
    var remReplace = createRemReplace(opts.rootValue, opts.unitPrecision, opts.minRemValue);

    var satisfyPropList = createPropListMatcher(opts.propList);

    return function (css) {

        css.walkDecls(function (decl, i) {
            // This should be the fastest test and will remove most declarations
            if (decl.value.indexOf('rem') === -1) return;

            if (!satisfyPropList(decl.prop)) return;

            if (blacklistedSelector(opts.selectorBlackList, decl.parent.selector)) return;

            var value = decl.value.replace(remRegex, remReplace);

            // if px unit already exists, do not add or replace
            if (declarationExists(decl.parent, decl.prop, value)) return;

            if (opts.replace) {
                decl.value = value;
            } else {
                decl.parent.insertAfter(i, decl.clone({ value: value }));
            }
        });

        if (opts.mediaQuery) {
            css.walkAtRules('media', function (rule) {
                if (rule.params.indexOf('rem') === -1) return;
                rule.params = rule.params.replace(remRegex, remReplace);
            });
        }

    };
});
plugin.postcss = true

module.exports = plugin;

function createRemReplace (rootValue, unitPrecision, minRemValue) {
    return function (m, $1) {
        if (!$1) return m;
        var rems = parseFloat($1);
        if (rems < minRemValue) return m;
        var fixedVal = toFixed((rems * rootValue), unitPrecision);
        return (fixedVal === 0) ? '0' : fixedVal + 'px';
    };
}

function toFixed(number, precision) {
    var multiplier = Math.pow(10, precision + 1),
    wholeNumber = Math.floor(number * multiplier);
    return Math.round(wholeNumber / 10) * 10 / multiplier;
}

function declarationExists(decls, prop, value) {
    return decls.some(function (decl) {
        return (decl.prop === prop && decl.value === value);
    });
}

function blacklistedSelector(blacklist, selector) {
    if (typeof selector !== 'string') return;
    return blacklist.some(function (regex) {
        if (typeof regex === 'string') return selector.indexOf(regex) !== -1;
        return selector.match(regex);
    });
}

function createPropListMatcher(propList) {
    var hasWild = propList.indexOf('*') > -1;
    var matchAll = (hasWild && propList.length === 1);
    var lists = {
        exact: filterPropList.exact(propList),
        contain: filterPropList.contain(propList),
        startWith: filterPropList.startWith(propList),
        endWith: filterPropList.endWith(propList),
        notExact: filterPropList.notExact(propList),
        notContain: filterPropList.notContain(propList),
        notStartWith: filterPropList.notStartWith(propList),
        notEndWith: filterPropList.notEndWith(propList)
    };
    return function (prop) {
        if (matchAll) return true;
        return (
            (
                hasWild ||
                lists.exact.indexOf(prop) > -1 ||
                lists.contain.some(function (m) {
                    return prop.indexOf(m) > -1;
                }) ||
                lists.startWith.some(function (m) {
                    return prop.indexOf(m) === 0;
                }) ||
                lists.endWith.some(function (m) {
                    return prop.indexOf(m) === prop.length - m.length;
                })
            ) &&
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
