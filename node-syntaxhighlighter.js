var fs         =  require('fs')
  , path       =  require('path')
  , util       =  require('util')
  , scriptsDir =  path.join(__dirname, './lib/scripts')
  , stylesDir  =  path.join(__dirname, './lib/styles')
  , styles
  , langMap    =  { }
  , similarMap =  { }
  , similarLangs =  {
        'js'     :  [ 'json' ]
      , 'python' :  ['coffee', 'groovy', 'hs', 'haskell' ]
    }
  ;


// Self invoking functions block until they are finished in order to ensure that 
// this module is properly initialized before it is returned.
// Since this only happens once (when module is required), it shouldn't be a problem.
(function mapBrushes() {
  fs.readdirSync(scriptsDir).forEach(function (file) {
    if (!file.match(/shBrush\w+\.js/)) return;
    
    var language = require(path.join(scriptsDir, file));
    language.Brush.aliases.forEach(function (alias) {
      langMap[alias.toLowerCase()] = language;
    });
  });  

  // Add some known aliases
  langMap['cs'] = langMap['c#'];

  // Add similar brushes to similar map
  Object.keys(similarLangs).forEach(function (lang) {
    similarLangs[lang].forEach(function (similar) {
      similarMap[similar] = langMap[lang];
    });
  });
}) ();

(function collectStyles () {
  styles = fs.readdirSync(stylesDir)
    .filter(function (fileName) {
      return fileName.match(/shCore.+\.css/);
    })
    .map(function (fileName) {
      var normalizedFileName =  fileName.replace(/shCore/, '')
        , extLength          =  path.extname(normalizedFileName).length
        , nameLength         =  normalizedFileName.length - extLength
        , styleName          =  normalizedFileName.substr(0, nameLength).toLowerCase()
        , fullFilePath       =  path.join(stylesDir, fileName)
        ;

      return { name: styleName, sourcePath: fullFilePath };
      
    });
}) ();

function getLanguage(alias, strict) {
  // accept *.ext, .ext and ext
  var normalizedAlias = alias.replace(/^\*/,'').replace(/^\./,'');

  return langMap[normalizedAlias] || (!strict ? similarMap[normalizedAlias] : void 0);
}

// options: http://alexgorbatchev.com/SyntaxHighlighter/manual/configuration/
function highlight(code, language, options) {
  var mergedOpts = { }
    , defaults = {
      toolbar: false
    };

  if (options) {
    // Gather all user specified options first
    Object.keys(options).forEach(function (key) {
      mergedOpts[key] = options[key];
    });
    // Add default option only if user didn't specify its value
    Object.keys(defaults).forEach(function (key) {
      mergedOpts[key] = options[key] || defaults[key];
    });

  } else {
    mergedOpts = defaults;
  }

  var brush = new language.Brush();

  brush.init(mergedOpts);

  return brush.getHtml(code);
}

function getStyles () {
  return styles;
}

function copyStyle (style, tgt, cb) {
  var sourcePath
    , styleName;

  // Allow style to just be a string (its name) or a style returned from getStyles
  if (typeof style === 'string') {
    styleName = style;

    var matchingStyle = styles.filter(function (s) { return s.name === style; })[0];

    if (!matchingStyle) 
      cb(new Error('Style named "' + style + '" not found.'));
    else
      sourcePath = matchingStyle.sourcePath;

  } else if (!style.sourcePath) {
    cb(new Error('style needs to be string or have "sourcePath" property'));
  } else {
    styleName = style.name;
    sourcePath = style.sourcePath;
  }

  var readStream = fs.createReadStream(sourcePath)
    , writeStream = fs.createWriteStream(path.join(tgt, styleName + '.css'))
    ; 

  util.pump(readStream, writeStream, cb);
}


function copyStyles(tgt, cb) {
  var pending = styles.length;
  styles.forEach(function (s) {
    copyStyle(s, tgt, function (err) {
      if (err) { 
        cb(err);
      } else {
        if (--pending === 0) cb();
      } 
    });
  });
}

copyStyles('./tmp', function (err) {
  console.log('copied with error: ', err);  
});

module.exports = {
    highlight   :  highlight
  , getLanguage :  getLanguage
  , getStyles   :  getStyles
  , copyStyle   :  copyStyle
  , copyStyles  :  copyStyles
};

