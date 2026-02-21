const { DetoxCircusEnvironment } = require('detox/runners/jest');

class CustomDetoxEnvironment extends DetoxCircusEnvironment {
  constructor(config, context) {
    super(config, context);
  }
}

module.exports = CustomDetoxEnvironment;
