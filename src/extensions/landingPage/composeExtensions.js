const mergePageBuilderOptions = (base, next) => {
  if (!base) {
    return next;
  }
  if (!next) {
    return base;
  }

  const baseSectionComponents = base?.sectionComponents || {};
  const nextSectionComponents = next?.sectionComponents || {};

  return {
    ...base,
    ...next,
    sectionComponents: {
      ...baseSectionComponents,
      ...nextSectionComponents,
    },
  };
};

const createSafeHook = hook => {
  const extensionHook = hook || {};
  return {
    loadDataExtension: extensionHook.loadDataExtension || (() => Promise.resolve()),
    selectExtensionProps: extensionHook.selectExtensionProps || (() => ({})),
    getPageBuilderOptions: extensionHook.getPageBuilderOptions || (() => undefined),
    transformPageData: extensionHook.transformPageData || (({ pageData }) => pageData),
  };
};

export const composeLandingPageExtensions = extensionHooks => {
  const hooks = (extensionHooks || []).map(createSafeHook);

  return {
    loadDataExtension: args => {
      const calls = hooks.map(hook => hook.loadDataExtension(args));
      return Promise.all(calls).then(() => undefined);
    },
    selectExtensionProps: args => {
      return hooks.reduce((collected, hook) => {
        const data = hook.selectExtensionProps(args) || {};
        return { ...collected, ...data };
      }, {});
    },
    getPageBuilderOptions: args => {
      return hooks.reduce((collected, hook) => {
        const options = hook.getPageBuilderOptions(args);
        return mergePageBuilderOptions(collected, options);
      }, undefined);
    },
    transformPageData: args => {
      return hooks.reduce((pageData, hook) => {
        return hook.transformPageData({ ...args, pageData });
      }, args.pageData);
    },
  };
};
