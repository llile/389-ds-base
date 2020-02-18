const path = require("path");
const copy = require("copy-webpack-plugin");
const extract = require("extract-text-webpack-plugin");
const fs = require("fs");
const webpack = require("webpack");
const CompressionPlugin = require("compression-webpack-plugin");

var externals = {
    cockpit: "cockpit"
};

/* These can be overridden, typically from the Makefile.am */
const srcdir = (process.env.SRCDIR || __dirname) + path.sep + "src";
const builddir = process.env.SRCDIR || __dirname;
const distdir = builddir + path.sep + "dist";
const section = process.env.ONLYDIR || null;
const nodedir = path.resolve(process.env.SRCDIR || __dirname, "node_modules");

/* A standard nodejs and webpack pattern */
var production = process.env.NODE_ENV === "production";

var info = {
    entries: {
        index: ["./index.es6"]
    },
    files: [
        "banner.html",
        "css",
        "fonts",
        "images",
        "index.html",
        "static",
        "manifest.json"
    ]
};

var output = {
    path: distdir,
    filename: "[name].js",
    sourceMapFilename: "[file].map"
};

/*
 * Note that we're avoiding the use of path.join as webpack and nodejs
 * want relative paths that start with ./ explicitly.
 *
 * In addition we mimic the VPATH style functionality of GNU Makefile
 * where we first check builddir, and then srcdir.
 */

function vpath(/* ... */) {
    var filename = Array.prototype.join.call(arguments, path.sep);
    var expanded = builddir + path.sep + filename;
    if (fs.existsSync(expanded)) return expanded;
    expanded = srcdir + path.sep + filename;
    return expanded;
}

/* Qualify all the paths in entries */
Object.keys(info.entries).forEach(function(key) {
    if (section && key.indexOf(section) !== 0) {
        delete info.entries[key];
        return;
    }

    info.entries[key] = info.entries[key].map(function(value) {
        if (value.indexOf("/") === -1) return value;
        else return vpath(value);
    });
});

/* Qualify all the paths in files listed */
var files = [];
info.files.forEach(function(value) {
    if (!section || value.indexOf(section) === 0)
        files.push({ from: vpath("src", value), to: value });
});
info.files = files;

var plugins = [new copy(info.files), new extract("[name].css")];

/* Only minimize when in production mode */
if (production) {
    /* Rename output files when minimizing */
    output.filename = "[name].min.js";

    plugins.unshift(
        new webpack.DefinePlugin({
            "process.env": {
                NODE_ENV: JSON.stringify("production")
            }
        })
    );
    plugins.unshift(new webpack.optimize.AggressiveMergingPlugin());
    plugins.unshift(
        new CompressionPlugin({
            filename: "[path].gz[query]",
            test: /\.(js|html)$/,
            threshold: 10240,
            minRatio: 0.8,
            deleteOriginalAssets: true
        })
    );
}

module.exports = {
    mode: production ? "production" : "development",
    entry: info.entries,
    externals: externals,
    output: output,
    devtool: "source-map",
    module: {
        rules: [
            {
                enforce: "pre",
                exclude: /node_modules/,
                loader: "eslint-loader",
                test: /\.jsx$/
            },
            {
                enforce: "pre",
                exclude: /node_modules/,
                loader: "eslint-loader",
                test: /\.es6$/
            },
            {
                exclude: /node_modules/,
                loader: "babel-loader",
                test: /\.js$/
            },
            {
                exclude: /node_modules/,
                loader: "babel-loader",
                test: /\.jsx$/,
                options: {
                    presets: [
                        "@babel/preset-env",
                        "@babel/preset-react",
                        {
                            plugins: ["@babel/plugin-proposal-class-properties"]
                        }
                    ]
                }
            },
            {
                exclude: /node_modules/,
                loader: "babel-loader",
                test: /\.es6$/
            },
            {
                // Transform our own .css files with PostCSS and CSS-modules
                test: /\.css$/,
                exclude: /node_modules/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.css$/,
                include: /node_modules/,
                use: ["style-loader", "css-loader"]
            },
            {
                test: /\.(png|jpg|gif)$/i,
                use: [
                    {
                        loader: "url-loader",
                        options: {
                            limit: 8192
                        }
                    }
                ]
            }
        ]
    },
    plugins: plugins
};
