# 第三方来源与制作记录

- [PC2005-cloud/dsh-pet](https://github.com/PC2005-cloud/dsh-pet)：MIT，桌宠交互引擎、蓝发大肥鱼素材与原制作流程。保留版权声明。
- [Sutera-Diffusus/dsh-whale-musume](https://github.com/Sutera-Diffusus/dsh-whale-musume)：MIT，鲸鱼娘素材与设计。保留版权声明。
- 本独立版从 [JoenardoQ/Deepseek-and-ChatGPT-Pet-and-JonsboAIO](https://github.com/JoenardoQ/Deepseek-and-ChatGPT-Pet-and-JonsboAIO) 的 `73c2178892b4840b78e8b373f29e171872a93e24` 提取。原版权声明中保留历史适配说明，不表示包含屏幕 SDK。
- DeepSeek 的 106 + 8 个 WebM 原样保留；文件哈希在 `art-source/upstream-media.json` 中。ChatGPT 旧 GIF/视频没有进入本仓库。
- ChatGPT 新静态图、双人静态场景由内置 image_gen 根据既有参考生成；动作类型、完整 prompts、旧动作映射与最终 PNG 哈希位于 `art-source/`。本版直接使用透明图集，由运行时裁取单格，不编码 GIF/视频。
- Electron、NPM 依赖、字体和其他沿用资源适用各自许可；本仓库不包含 Electron 或 Node 二进制。字体目录如附带许可证应一并保留。
- 适配维护：Qiao, Yanning / JoenardoQ。ChatGPT / Codex 为代码、文案和图像制作协作工具，不是独立版权主体。参考形象的既有权利不会因生成或适配而转移。

根目录和 dsh-pet 目录中的 LICENSE 保留原 MIT 文本。
