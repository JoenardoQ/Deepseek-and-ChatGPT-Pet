# 本地协调协议 v1

默认 `http://127.0.0.1:19420`，服务标识 `desktop-pet`。所有变更请求必须使用 POST、JSON 对象、`X-Pet-Client: 1`，限制 8192 bytes。Host 只接受 localhost/127.0.0.1；跨 Origin 请求拒绝。仅绑定回环地址，不应将端口转发到公网。

| 路由 | 用途 |
| --- | --- |
| GET /state | 服务版本、控制会话、桌面子进程、在线角色和双人场景 |
| GET /control | 当前可见性、桌面开关、工作状态、短台词和 revision |
| POST /event | source=chatgpt，action=wake/update/hide；state、message、desktop、可选 sessionId |
| POST /host | 插件会话心跳/释放：id，release 可选 |
| POST /presence | source=dsh/chatgpt、character、desktop、instanceId、build、error |
| POST /duet | mode=auto/off 或 actions.json 中的场景 ID |
| POST /pet/close | 关闭独立桌宠及其全部会话 |
| POST /shutdown | 关闭本协调器及其创建的独立子进程 |

工作状态为 idle/thinking/working/success/error/sleeping。无 sessionId 的 CLI 控制持续到显式关闭；MCP 会话通过 /host 定期续租。工作/思考状态过期回到 idle，宿主失联会撤回所属会话，双人场景随双方心跳失效而解除。

读取状态不启动窗口；wake 负责启动独立服务，再由 Electron 上报真实 presence。desktop.pid 只说明进程已创建，connectedSources、characters 和实际窗口用于确认显示。

此协议没有 /frame、/device/*，也不接受 screen 参数。角色资源由内部桌宠服务提供；未来角色通过 PetPack 接口加入，不扩展设备协议。

MCP 的短台词字段不会自动复制用户聊天内容。默认未开启对话模型调用；启用碎碎念/聊天时遵循宿主原有模型与凭据配置。
