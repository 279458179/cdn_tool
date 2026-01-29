// 默认优选 IP 列表 (示例数据，实际使用时建议从 API 获取最新)
const DEFAULT_IPS = {
    cloudflare: [
        "104.16.123.96",
        "172.67.123.45",
        "104.21.12.34",
        "188.114.96.1",
        "188.114.97.2"
    ],
    cloudfront: [
        "13.224.1.1",
        "13.224.2.2"
    ],
    gcore: [
        "92.223.84.1",
        "92.223.84.2"
    ],
    custom: []
};

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    updateDefaultIPs();
});

// 更新优选 IP 输入框
function updateDefaultIPs() {
    const provider = document.getElementById('cdnProvider').value;
    const ipArea = document.getElementById('bestIPs');
    
    if (provider === 'custom') {
        ipArea.value = '';
        ipArea.placeholder = "请输入自定义 IP，每行一个...";
    } else {
        ipArea.value = DEFAULT_IPS[provider].join('\n');
    }
}

// 模拟获取公开优选库 (实际项目中可以替换为 fetch 真实的 GitHub Raw URL)
async function fetchPublicIPs() {
    const provider = document.getElementById('cdnProvider').value;
    const btn = document.querySelector('.quick-actions .btn-small');
    
    // 视觉反馈
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 获取中...';
    
    try {
        // 这里为了演示，我们使用延时模拟网络请求
        // 实际可以 fetch('https://raw.githubusercontent.com/example/best-cf-ips/main/ips.txt')
        await new Promise(r => setTimeout(r, 800));
        
        // 恢复默认数据 (这里只是重置回示例数据，真实环境应解析 response)
        updateDefaultIPs();
        
        alert(`已加载 ${provider} 的最新优选 IP 库`);
    } catch (e) {
        alert('获取失败，请检查网络');
    } finally {
        btn.innerHTML = originalText;
    }
}

function clearIPs() {
    document.getElementById('bestIPs').value = '';
}

// 核心生成逻辑
function generateNodes() {
    const rawInput = document.getElementById('rawNodes').value.trim();
    const bestIPsInput = document.getElementById('bestIPs').value.trim();
    
    if (!rawInput) {
        alert('请先输入原始节点链接！');
        return;
    }
    
    if (!bestIPsInput) {
        alert('请提供优选 IP 列表！');
        return;
    }

    const rawNodes = rawInput.split('\n').filter(line => line.trim() !== '');
    const bestIPs = bestIPsInput.split('\n').filter(line => line.trim() !== '');
    
    let generatedNodes = [];

    // 遍历每一个原始节点
    rawNodes.forEach(nodeLink => {
        try {
            // 解析节点
            const nodeInfo = parseNode(nodeLink);
            if (!nodeInfo) return; // 跳过无法解析的行

            // 遍历每一个优选 IP，生成一个新节点
            bestIPs.forEach((ip, index) => {
                const newNode = replaceIP(nodeInfo, ip, index + 1);
                generatedNodes.push(newNode);
            });
        } catch (e) {
            console.error('解析错误:', e);
        }
    });

    // 输出结果
    const resultArea = document.getElementById('resultOutput');
    resultArea.value = generatedNodes.join('\n');
    
    // 更新统计
    document.getElementById('stats').innerText = `生成: ${generatedNodes.length} 个节点`;
}

// 简单的节点解析器 (支持 vmess, vless, trojan)
function parseNode(link) {
    link = link.trim();
    if (link.startsWith('vmess://')) {
        return { type: 'vmess', raw: link };
    } else if (link.startsWith('vless://')) {
        return { type: 'vless', raw: link };
    } else if (link.startsWith('trojan://')) {
        return { type: 'trojan', raw: link };
    }
    return null;
}

// 替换 IP 逻辑
function replaceIP(nodeInfo, newIP, index) {
    // 这里需要处理具体的协议格式。
    // Vmess 通常是 Base64 编码的 JSON
    // Vless/Trojan 是明文 URI
    
    const cleanIP = newIP.trim();
    
    if (nodeInfo.type === 'vmess') {
        try {
            const b64 = nodeInfo.raw.substring(8);
            const jsonStr = atob(b64);
            const config = JSON.parse(jsonStr);
            
            // 核心替换逻辑：
            // 1. 将 address (add) 改为优选 IP
            // 2. 将 host (host) 或 sni (sni) 确保为原始域名 (通常 vmess 原始域名就在 add 里，如果 add 是域名的话)
            //    注意：如果原始 add 已经是 IP，那么我们需要用户手动指定 host，或者这里假设原始 add 就是 host。
            //    为了简单，我们假设原始配置是正确的 CDN 节点 (add=domain, host=domain/empty)
            
            // 备份原始域名用于备注
            const originalAdd = config.add;
            
            // 设置 SNI/Host (如果原始没有 host，通常 add 就是 host)
            if (!config.host) config.host = originalAdd;
            if (!config.sni) config.sni = originalAdd;
            
            // 替换地址
            config.add = cleanIP;
            
            // 修改备注 (ps)
            config.ps = `${config.ps}_优选_${index}`;
            
            return 'vmess://' + btoa(JSON.stringify(config));
        } catch (e) {
            return nodeInfo.raw; // 解析失败返回原样
        }
    } 
    
    else if (nodeInfo.type === 'vless' || nodeInfo.type === 'trojan') {
        try {
            // URI 格式: protocol://uuid@address:port?params#remark
            const url = new URL(nodeInfo.raw);
            
            // 保存原始地址作为 host/sni
            const originalHost = url.hostname;
            
            // 更新 params 中的 host 和 sni
            if (!url.searchParams.has('host')) url.searchParams.set('host', originalHost);
            if (!url.searchParams.has('sni')) url.searchParams.set('sni', originalHost);
            
            // 替换 hostname 为优选 IP
            url.hostname = cleanIP;
            
            // 更新备注
            url.hash = url.hash ? `${url.hash}_${index}` : `_Node_${index}`;
            
            return url.toString();
        } catch (e) {
            return nodeInfo.raw;
        }
    }
    
    return nodeInfo.raw;
}

function copyResult() {
    const resultArea = document.getElementById('resultOutput');
    resultArea.select();
    document.execCommand('copy');
    alert('已复制到剪贴板');
}

function downloadSub() {
    const content = document.getElementById('resultOutput').value;
    if (!content) {
        alert('没有内容可下载');
        return;
    }
    const blob = new Blob([base64Encode(content)], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'best_nodes_subscription.txt';
    a.click();
    URL.revokeObjectURL(url);
}

// 简单的 Base64 编码 (用于生成订阅内容)
function base64Encode(str) {
    return btoa(unescape(encodeURIComponent(str)));
}
