import OptionsSync from "webext-options-sync";

export const defaultOptions = {
  colorRed: 255,
  colorGreen: 128,
  colorBlue: 64,
  text: "Set a text!",
};

const optionsStorage = new OptionsSync({
  defaults: defaultOptions,
  migrations: [OptionsSync.migrations.removeUnused],
  logging: true,
});

export default optionsStorage;
