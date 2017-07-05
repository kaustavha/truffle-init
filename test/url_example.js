var temp = require("temp").track();
var path = require("path");
var fs = require("fs-extra");
var assert = require("assert");
var Init = require("../");

describe("URL", function() {
  var config = {
    logger: {
      log: function() {}
    },
    working_directory: path.join(__dirname, ".truffle_test_temp")
  };
  var destination = config.working_directory;

  before("mkdir", function(done) {
    fs.ensureDir(config.working_directory, done);
  });

  after("remove temp directory", function(done) {
    fs.remove(config.working_directory, done);
  });

  before("download webpack example from github but direct from URL", function() {
    // we need to install dependencies
    this.timeout(120000);

    return Init.fromGithub(config, "https://github.com/dougvk/truffle3-frontend-example", destination).then(function() {
      var expected_file_path = path.join(destination, "truffle.js");
      assert(fs.existsSync(expected_file_path), "Expected file doesn't exist!");
    });
  });

  it("will install package.json dependencies", function() {
    var pkg = require(path.join(destination, "package.json"));

    Object.keys(pkg.devDependencies).forEach(function(dep) {
      var expected_path = path.join(destination, "node_modules", dep);
      assert(fs.existsSync(expected_path), "Couldn't find dep " + dep);
    });
  });
});
