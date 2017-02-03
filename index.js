var temp = require("temp");
var ghdownload = require('github-download');
var path = require("path");
var fs = require("fs-extra");
var https = require("https");
var npm = require('npm-programmatic');

var Init = {

  // Note we use a temporary directory because ghdownload doesn't like
  // when the directory exists.
  fromGithub: function(config, name, destination) {
    var expected_full_name = "truffle-init-" + name;
    var temp_directory = temp.path({prefix: name + "-"});

    var init_config;

    // First let's see if the expected repository exists. If it doesn't, ghdownload
    // will fail spectacularly in a way we can't catch.
    return new Promise(function(accept, reject) {

      var options = {
        method: 'HEAD',
        host: 'raw.githubusercontent.com',
        path: '/trufflesuite/' + expected_full_name + "/master/truffle.js"
      };
      req = https.request(options, function(r) {
        if (r.statusCode == 404) {
          return reject(new Error("Example '" + name + "' doesn't exist. If you believe this is an error, please contact Truffle support."));
        } else if (r.statusCode != 200) {
          return reject(new Error("Error connecting to github.com. Please check your internet connection and try again."));
        }
        accept();
      });
      req.end();

    }).then(function() {

      return new Promise(function(accept, reject) {
        config.logger.log("Downloading project...");

        // Download the package from github.
        ghdownload({
          user: 'trufflesuite',
          repo: expected_full_name,
          ref: 'master'
        }, temp_directory)
        .on('err', function(err) {
          reject(err);
        })
        .on('end', function(a) {
          accept();
        });
      });

    }).then(function() {
      // Copy the data and remove the temp directory.
      return new Promise(function(accept, reject) {
        fs.copy(temp_directory, destination, function(err) {
          if (err) return reject(err);
          fs.remove(temp_directory, function(err) {
            if (err) return reject(err);
            accept();
          });
        });
      });
    }).then(function() {
      // Find the truffle-init.json file, and remove anything that should be ignored.
      return new Promise(function(accept, reject) {
        fs.readFile(path.join(destination, "truffle-init.json"), "utf8", function(err, body) {
          // We can't read the file, so let's assume it doesn't exist.
          if (err) {
            return accept({});
          }

          try {
            body = JSON.parse(body);
          } catch (e) {
            // If the file exists but we can't parse it, let's expose that error.
            return reject(e);
          }

          // Now that we have the config, edit it to set it to remove the truffle-init.json file.
          body.ignore = body.ignore || [];
          body.ignore.push("truffle-init.json");

          // Otherwise, we got it.
          accept(body);
        });
      });
    }).then(function(conf) {
      init_config = conf;

      var things_to_delete = init_config.ignore || [];

      var promises = things_to_delete.map(function(file_path) {
        return path.join(destination, file_path);
      }).map(function(file_path) {
        return new Promise(function(accept, reject) {
          fs.remove(file_path, function(err) {
            if (err) return reject(err);
            accept();
          });
        });
      });

      return Promise.all(promises);
    }).then(function() {
      // Run an npm install if a package.json exists.
      if (fs.existsSync(path.join(destination, "package.json")) == false) {
        return;
      }

      config.logger.log("Installing dependencies...");

      var pkg = require(path.join(destination, "package.json"));

      var packages = [];

      Object.keys(pkg.dependencies || {}).forEach(function(name) {
        var version = pkg.dependencies[name];
        packages.push(name + "@" + version);
      });

      Object.keys(pkg.devDependencies || {}).forEach(function(name) {
        var version = pkg.devDependencies[name];
        packages.push(name + "@" + version);
      });

      return npm.install(packages, {
        cwd: destination
      });
    }).then(function() {
      return init_config;
    });
  }
};

module.exports = Init;
