/* eslint-disable
  arrow-body-style
*/
import uglify from 'uglify-es';

const buildUglifyOptions = ({
  ie8,
  ecma,
  parse = {},
  mangle,
  output,
  compress = {},
  warnings,
  toplevel,
  nameCache,
} = {}) => ({
  ie8,
  ecma,
  parse,
  mangle: mangle == null ? true : mangle,
  output: {
    shebang: true,
    comments: /^\**!|@preserve|@license|@cc_on/,
    beautify: false,
    semicolons: true,
    ...output,
  },
  compress,
  warnings,
  toplevel,
  nameCache,
  // Ignoring sourcemap from options
  sourceMap: null,
});

const buildComments = (options, uglifyOptions, extractedComments) => {
  const condition = {};
  const commentsOpts = uglifyOptions.output.comments;

  if (
    typeof options.extractComments === 'string' ||
    options.extractComments instanceof RegExp
  ) {
    // extractComments specifies the extract condition and commentsOpts specifies the preserve condition
    condition.preserve = commentsOpts;
    condition.extract = options.extractComments;
  } else if (
    Object.prototype.hasOwnProperty.call(options.extractComments, 'condition')
  ) {
    // Extract condition is given in extractComments.condition
    condition.preserve = commentsOpts;
    condition.extract = options.extractComments.condition;
  } else {
    // No extract condition is given. Extract comments that match commentsOpts instead of preserving them
    condition.preserve = false;
    condition.extract = commentsOpts;
  }

  // Ensure that both conditions are functions
  ['preserve', 'extract'].forEach((key) => {
    let regexStr;
    let regex;

    switch (typeof (condition[key])) {
      case 'boolean':
        condition[key] = condition[key] ? () => true : () => false;

        break;
      case 'function':
        break;
      case 'string':
        if (condition[key] === 'all') {
          condition[key] = () => true;

          break;
        }

        if (condition[key] === 'some') {
          condition[key] = (astNode, comment) => {
            return comment.type === 'comment2' && /@preserve|@license|@cc_on/i.test(comment.value);
          };

          break;
        }

        regexStr = condition[key];

        condition[key] = (astNode, comment) => {
          return new RegExp(regexStr).test(comment.value);
        };

        break;
      default:
        regex = condition[key];

        condition[key] = (astNode, comment) => (regex.test(comment.value));
    }
  });

  // Redefine the comments function to extract and preserve
  // comments according to the two conditions
  return (astNode, comment) => {
    if (condition.extract(astNode, comment)) {
      extractedComments.push(
        comment.type === 'comment2' ? `/*${comment.value}*/` : `//${comment.value}`,
      );
    }

    return condition.preserve(astNode, comment);
  };
};

const minify = (options) => {
  const { file, input, inputSourceMap, extractComments } = options;
  // Copy uglify options
  const uglifyOptions = buildUglifyOptions(options.uglifyOptions);

  // Add source map data
  if (inputSourceMap) {
    uglifyOptions.sourceMap = {
      content: inputSourceMap,
    };
  }

  const extractedComments = [];

  if (extractComments) {
    uglifyOptions.output.comments = buildComments(
      options,
      uglifyOptions,
      extractedComments,
    );
  }

  const { error, map, code, warnings } = uglify.minify(
    { [file]: input },
    uglifyOptions,
  );

  return { error, map, code, warnings, extractedComments };
};

export default minify;
