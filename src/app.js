import { auditAd, getCases, getHealth, getLegalRules, getPlatformRules, rewriteChat as requestRewriteChat } from "./services/apiClient.js";
import { extractImage as requestImageExtract } from "./services/imageClient.js";
import { storage } from "./services/storage.js";
import { createWorkflowStore, initialAppState } from "./state.js";
import { initHomePage } from "./ui/home.js";
import { initWorkflowPage } from "./ui/workflow.js";
import { initReportPage } from "./ui/report.js";
import { initRewriteStudio } from "./ui/rewriteStudio.js";
import { initExamplesPage } from "./ui/examples.js";
import { initAboutPage } from "./ui/about.js";

const SimulationCases = [
  {
    id: "demo_beauty_xhs",
    title: "美妆小红书种草",
    productName: "云感修护精华",
    productCategory: "beauty",
    priceRange: "129-199元",
    sellingPoints: "肤感清爽\n主打日常维稳和提亮护理\n适合通勤前后使用",
    proofMaterials: "成分说明\n用户试用反馈摘要\n活动规则以官方页面为准",
    text: "这支精华真的绝了，3天白一个度，敏感肌闭眼入！现在全网最低，姐妹们再不买就亏了。",
    imageText: "云感修护精华\n限时买一送一\n主打清爽维稳\n立即查看",
    targetPlatform: "xiaohongshu",
    targetAudience: "ingredient",
    marketingStyle: "seeding",
    complianceStrength: "balanced",
    adGoal: "seeding"
  },
  {
    id: "demo_food_douyin",
    title: "食品饮料抖音口播",
    productName: "轻谷代餐奶昔",
    productCategory: "food",
    priceRange: "79-129元",
    sellingPoints: "冲泡方便\n口味清爽\n适合忙碌时作为轻食选择",
    proofMaterials: "配料表\n热量标识\n组合装活动规则",
    text: "想瘦的朋友看过来，这款代餐喝了就能瘦，今天直播间全网最低价，最后100份，抢不到就没了。",
    imageText: "轻谷代餐奶昔\n组合装优惠\n配料清楚\n先领券再对比",
    targetPlatform: "douyin",
    targetAudience: "price_sensitive",
    marketingStyle: "conversion",
    complianceStrength: "balanced",
    adGoal: "promotion"
  },
  {
    id: "demo_edu_private",
    title: "教育课程私域转化",
    productName: "初中数学阶段提升课",
    productCategory: "education",
    priceRange: "体验课29元",
    sellingPoints: "课前基础测评\n阶段学习建议\n课后练习反馈",
    proofMaterials: "课程大纲\n阶段测评样例\n服务流程说明",
    text: "家长注意，孩子数学不好再拖就晚了。我们的课程30天保证提分，今天只剩最后3个名额，私信我马上锁定。",
    imageText: "阶段测评体验课\n本周可预约\n先测评再规划\n私信发送年级",
    targetPlatform: "wechat",
    targetAudience: "mom",
    marketingStyle: "conversion",
    complianceStrength: "strict",
    adGoal: "private_conversion"
  },
  {
    id: "demo_ai_tool",
    title: "AI工具产品推广",
    productName: "BriefPilot 提纲助手",
    productCategory: "ai_tool",
    priceRange: "免费试用 / 专业版39元起",
    sellingPoints: "一键整理提纲\n支持会议纪要和营销方案\n可导出 Markdown",
    proofMaterials: "功能说明\n试用入口\n隐私处理说明",
    text: "用了这个AI工具，方案效率直接提升10倍，论文和报告都能一键搞定，打工人和学生党必备。",
    imageText: "BriefPilot 提纲助手\n从空白页到清晰结构\n支持试用\n导出报告",
    targetPlatform: "xiaohongshu",
    targetAudience: "white_collar",
    marketingStyle: "trustworthy",
    complianceStrength: "balanced",
    adGoal: "launch"
  },
  {
    id: "demo_poster_image",
    title: "海报图片广告分析",
    productName: "城市轻食午餐卡",
    productCategory: "local_life",
    priceRange: "99元/5次",
    sellingPoints: "门店自取\n午餐套餐可选\n活动期赠送饮品券",
    proofMaterials: "门店地址\n活动起止时间\n套餐适用规则",
    text: "办公室午餐不用纠结，99元吃5次，错过今天就没有了，扫码马上买。",
    imageText: "午餐卡 99元/5次\n活动到本周五\n门店自取\n扫码领取饮品券",
    targetPlatform: "offline",
    targetAudience: "white_collar",
    marketingStyle: "gentle_urgency",
    complianceStrength: "balanced",
    adGoal: "promotion"
  }
];
const FieldLabels = {
      contentType: {
        auto: "自动识别",
        xiaohongshu_note: "小红书种草笔记",
        short_video_script: "短视频脚本",
        live_script: "直播话术",
        product_detail: "商品详情页",
        promo_poster: "促销海报",
        private_community: "私域社群文案"
      },
      industry: {
        auto: "自动识别",
        beauty: "美妆护肤",
        food: "食品饮料",
        education: "教育培训",
        fashion: "服饰穿搭",
        pet: "宠物用品",
        digital: "数码家电",
        local_life: "本地生活",
        ai_tool: "AI工具",
        other: "其他"
      },
      mode: {
        quick: "快速审查",
        deep: "深度审查"
      },
      tone: {
        safe: "保守稳妥",
        balanced: "平衡营销效果与风险",
        original: "尽量保留原文风格"
      }
    };

    const SampleRepository = {
      items: [
        {
          title: "美妆种草笔记",
          industry: "beauty",
          contentType: "xiaohongshu_note",
          text: "姐妹们闭眼入！这款精华真的太神了，3天就能白一个度，全网第一美白神器，敏感肌也100%能用。我已经推荐给所有朋友了，再不买就亏大了！"
        },
        {
          title: "教育培训广告",
          industry: "education",
          contentType: "promo_poster",
          text: "报名我们的课程，30天英语成绩必定提高，名师一对一辅导，历年学员通过率全行业第一，最后3个名额，今天不报就没机会了。"
        },
        {
          title: "食品饮料促销",
          industry: "food",
          contentType: "short_video_script",
          text: "这款代餐奶昔喝了就能瘦，0负担0风险，明星同款，全网最低价，只要坚持一周就能看到明显变化。"
        }
      ]
    };

    const RiskDimensionMeta = {
      complianceExpression: { label: "合规表达风险", weight: 30 },
      factualEvidence: { label: "事实证据风险", weight: 20 },
      consumerMisleading: { label: "消费者误导风险", weight: 20 },
      brandTrustRisk: { label: "品牌信任风险", weight: 20 },
      platformRisk: { label: "平台发布风险", weight: 10 }
    };

    const TrustDimensionMeta = {
      authenticity: { label: "真实性", weight: 25 },
      evidence: { label: "证据性", weight: 25 },
      transparency: { label: "透明性", weight: 20 },
      restraint: { label: "克制性", weight: 15 },
      brandConsistency: { label: "品牌一致性", weight: 15 }
    };

    const RiskRuleRepository = {
      rules: [
        {
          type: "绝对化表达",
          level: "高",
          dimensions: ["complianceExpression", "consumerMisleading"],
          impact: 82,
          keywords: ["全网第一", "全行业第一", "第一", "最好", "最佳", "顶级", "永久有效", "史上最强", "全网最低", "绝对有效", "100%"],
          reason: "使用绝对化或排他性表达，容易形成无法证明的确定性判断。",
          evidenceNeeded: "排名依据、统计口径或第三方证明材料",
          guidance: "弱化排名和绝对承诺，改为可验证、可解释的相对表达。"
        },
        {
          type: "夸大效果",
          level: "高",
          dimensions: ["consumerMisleading", "brandTrustRisk"],
          impact: 78,
          keywords: ["3天", "三天", "一次解决", "立刻", "马上见效", "白一个度", "明显变化", "效果惊人", "30天"],
          reason: "对效果达成时间或强度作出过度承诺，缺少可验证依据。",
          evidenceNeeded: "实验条件、样本说明、效果评估周期或用户反馈来源",
          guidance: "改为“有助于”“部分用户反馈”“持续使用后可能感受到变化”。"
        },
        {
          type: "功效承诺",
          level: "高",
          dimensions: ["complianceExpression", "consumerMisleading", "brandTrustRisk"],
          impact: 92,
          keywords: ["治愈", "根治", "包瘦", "喝了就能瘦", "祛斑必成", "保证成绩", "必定提高", "0风险"],
          reason: "存在确定性功效、健康效果或学习结果承诺，风险较高。",
          evidenceNeeded: "产品检测依据、适用条件、效果差异说明或服务结果边界",
          guidance: "删除确定性功效承诺，补充适用条件和效果差异说明。"
        },
        {
          type: "证据不足",
          level: "中",
          dimensions: ["factualEvidence", "brandTrustRisk"],
          impact: 72,
          keywords: ["权威认证", "专家推荐", "名师", "明星同款", "销量第一", "通过率", "99%用户", "检测报告"],
          reason: "涉及权威背书、数据排名或第三方推荐，但文本未说明来源、口径或证明材料。",
          evidenceNeeded: "检测报告来源、专家身份说明、排名统计口径或背书授权证明",
          guidance: "补充来源、统计口径、专家身份、检测条件，或删除无法验证的背书。"
        },
        {
          type: "价格误导",
          level: "中",
          dimensions: ["platformRisk", "consumerMisleading"],
          impact: 68,
          keywords: ["最后一天", "最后3个", "今天不报", "错过再等一年", "历史最低", "全网最低价", "原价"],
          reason: "稀缺性、限时性或价格对比依据不清，可能造成压力销售或价格误导。",
          evidenceNeeded: "价格活动规则、库存依据、活动起止时间或价格对比口径",
          guidance: "明确活动时间、数量依据、价格口径，避免制造虚假稀缺感。"
        },
        {
          type: "广告属性不透明",
          level: "中",
          dimensions: ["brandTrustRisk", "platformRisk"],
          impact: 64,
          keywords: ["购买链接", "下单", "领取优惠", "种草", "带货", "同款链接"],
          reason: "内容带有明显导购意图时，需要更清楚说明推广、合作或购买引导关系。",
          evidenceNeeded: "推广关系、合作说明、试用来源或购买引导说明",
          guidance: "增加推广、合作、试用、赞助或购买引导说明。"
        },
        {
          type: "用户评价滥用",
          level: "中",
          dimensions: ["brandTrustRisk", "factualEvidence"],
          impact: 62,
          keywords: ["所有朋友", "大家都说", "用了都说好", "真实反馈", "人人都适合"],
          reason: "用个别或泛化评价代表普遍结果，容易让消费者形成过高预期。",
          evidenceNeeded: "用户反馈样本范围、评价来源或适用人群说明",
          guidance: "改为“部分用户反馈”，并避免扩大样本代表性。"
        },
        {
          type: "内容真实性风险",
          level: "中",
          dimensions: ["brandTrustRisk", "factualEvidence"],
          impact: 70,
          keywords: ["虚构", "模拟用户", "生成评价", "假设专家", "前后对比图"],
          reason: "涉及可能无法验证的用户、专家、测评或图像描述，需要避免虚构事实。",
          evidenceNeeded: "真实用户授权、测评过程记录、专家身份或素材来源说明",
          guidance: "仅保留真实可验证信息，或明确说明为模拟示例。"
        },
        {
          type: "焦虑营销",
          level: "中",
          dimensions: ["consumerMisleading", "brandTrustRisk"],
          impact: 58,
          keywords: ["再不买", "亏大了", "不买就落后", "没机会", "闭眼入"],
          reason: "通过焦虑或强推销话术促使用户立即行动，可能削弱品牌可信度。",
          evidenceNeeded: "活动规则、适用场景或用户选择依据",
          guidance: "改为理性推荐，强调适用场景和选择理由。"
        }
      ]
    };

    const PromptTemplateModule = {
      systemPrompt: `你是 AdTrust AI 消费者信任与广告转化优化官。你的任务是帮助品牌营销人员、中小商家和内容创作者在发布前判断广告是否可信、是否吸引目标消费者、是否具备销售转化潜力，并提出更有营销张力且保留合规底线的改写建议。你不是律师，不提供法律结论，不判断违法或不违法。禁止编造法规、检测报告、专家身份、用户反馈或数据来源。输出必须结构化。改写必须降低信任阻碍，不能直接复制原文。`,
      buildUserPrompt(request) {
        return `请优化以下广告内容。\n\n广告文本：${request.text}\n产品名称：${request.productName || "未填写"}\n产品品类：${FieldLabels.industry[request.productCategory] || "其他"}\n目标平台：${MarketingOptimizer.platformLabels[request.targetPlatform] || "通用"}\n目标消费者：${MarketingOptimizer.audienceLabels[request.targetAudience] || "自动推断"}\n营销风格：${request.marketingStyle || "专业可信"}\n合规强度：${request.complianceStrength || "平衡"}\n\n要求：不提供法律结论；不编造证据；不虚构法规、专家或用户反馈；输出必须结构化；改写必须降低信任阻碍并提升转化吸引力，不能直接复制原文。请输出消费者画像、五项核心指标、圈层偏好分析、信任阻碍点、转化损耗点、合规底线提醒、五版改写和报告。`;
      }
    };

    const TextToolkit = {
      splitSentences(text) {
        return text
          .replace(/\s+/g, " ")
          .split(/(?<=[。！？!?；;])|\n+/)
          .map(item => item.trim())
          .filter(Boolean);
      },
      escapeHtml(value) {
        return String(value)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;");
      }
    };

    const ContentClassifier = {
      inferContentType(text, selected) {
        if (selected !== "auto") return FieldLabels.contentType[selected];
        if (/直播|上链接|拍一号|库存|主播/.test(text)) return "直播话术";
        if (/详情|参数|规格|保障|卖点|原价/.test(text)) return "商品详情页";
        if (/姐妹|种草|笔记|闭眼入|同款链接/.test(text)) return "小红书种草笔记";
        if (/口播|镜头|开场|结尾|短视频/.test(text)) return "短视频脚本";
        if (/最后|限时|促销|海报|全网最低/.test(text)) return "促销海报";
        if (/群里|私聊|社群|领取/.test(text)) return "私域社群文案";
        return "广告文案";
      },
      inferIndustry(text, selected) {
        if (selected !== "auto") return FieldLabels.industry[selected];
        if (/精华|美白|护肤|敏感肌|肤色|暗沉/.test(text)) return "美妆护肤";
        if (/代餐|奶昔|食品|饮料|喝/.test(text)) return "食品饮料";
        if (/课程|成绩|英语|辅导|学员/.test(text)) return "教育培训";
        if (/穿搭|衣服|面料|显瘦/.test(text)) return "服饰穿搭";
        if (/宠物|猫|狗|粮/.test(text)) return "宠物用品";
        if (/手机|数码|家电|参数/.test(text)) return "数码家电";
        if (/门店|到店|本地/.test(text)) return "本地生活";
        if (/AI|智能|模型|自动生成/.test(text)) return "AI工具";
        return "其他";
      },
      inferIntent(text) {
        if (/下单|购买|报名|优惠|领取|促销|带货|名额/.test(text)) return "转化促销";
        if (/种草|分享|体验|推荐/.test(text)) return "种草推荐";
        return "品牌传播";
      },
      inferAudience(text) {
        if (/姐妹|美白|护肤|敏感肌/.test(text)) return "关注护肤效果的年轻消费者";
        if (/课程|英语|成绩|辅导/.test(text)) return "有学习提升需求的学生或家长";
        if (/代餐|瘦|奶昔/.test(text)) return "关注体重管理和轻食消费的人群";
        if (/直播|下单|优惠/.test(text)) return "直播间或社群中的潜在购买用户";
        return "对产品或服务有兴趣的潜在消费者";
      },
      analyze(request) {
        return {
          contentType: this.inferContentType(request.text, request.contentType),
          industry: this.inferIndustry(request.text, request.industry),
          intent: this.inferIntent(request.text),
          targetAudienceGuess: this.inferAudience(request.text),
          mode: FieldLabels.mode[request.mode],
          confidence: request.text.length > 20 ? 0.86 : 0.66
        };
      }
    };

    const LocalRuleEngine = {
      detect(text) {
        const sentences = TextToolkit.splitSentences(text);
        return sentences.map((sentence, index) => {
          const matchedRules = RiskRuleRepository.rules.filter(rule => rule.keywords.some(keyword => sentence.includes(keyword)));
          if (!matchedRules.length) return null;
          const level = matchedRules.some(rule => rule.level === "高") ? "高" : "中";
          const affectedDimensions = Array.from(new Set(matchedRules.flatMap(rule => rule.dimensions)));
          return {
            id: `risk-${index + 1}`,
            sentence,
            riskTypes: matchedRules.map(rule => rule.type),
            riskLevel: level,
            affectedDimensions,
            affectedDimensionLabels: affectedDimensions.map(key => RiskDimensionMeta[key].label),
            reason: matchedRules.map(rule => rule.reason).join(" "),
            evidenceNeeded: Array.from(new Set(matchedRules.map(rule => rule.evidenceNeeded))).join("；"),
            guidance: matchedRules.map(rule => rule.guidance).join(" "),
            rewrite: "",
            impact: Math.max(...matchedRules.map(rule => rule.impact))
          };
        }).filter(Boolean);
      }
    };

    const ScoringModel = {
      scoreRisk(items) {
        const riskDimensions = {};
        Object.keys(RiskDimensionMeta).forEach(key => {
          const related = items.filter(item => item.affectedDimensions.includes(key));
          const averageImpact = related.length
            ? Math.round(related.reduce((sum, item) => sum + item.impact, 0) / related.length)
            : 0;
          const frequencyBoost = Math.min(18, Math.max(0, related.length - 1) * 6);
          riskDimensions[key] = Math.min(100, averageImpact + frequencyBoost);
        });
        const total = Math.round(Object.entries(riskDimensions).reduce((sum, [key, value]) => {
          return sum + value * RiskDimensionMeta[key].weight / 100;
        }, 0));
        return {
          score: total,
          level: total <= 20 ? "低风险" : total <= 50 ? "中风险" : total <= 75 ? "高风险" : "极高风险",
          dimensions: riskDimensions
        };
      },
      scoreTrust(riskScore, items) {
        const types = new Set(items.flatMap(item => item.riskTypes));
        const trustDimensions = {
          authenticity: 88,
          evidence: 86,
          transparency: 88,
          restraint: 90,
          brandConsistency: riskScore > 50 ? 70 : 84
        };
        if (types.has("内容真实性风险") || types.has("用户评价滥用")) trustDimensions.authenticity -= 32;
        if (types.has("证据不足") || types.has("用户评价滥用")) trustDimensions.evidence -= 38;
        if (types.has("广告属性不透明")) trustDimensions.transparency -= 36;
        if (types.has("绝对化表达") || types.has("夸大效果") || types.has("焦虑营销") || types.has("功效承诺")) trustDimensions.restraint -= 42;
        if (riskScore > 75) trustDimensions.brandConsistency -= 18;
        Object.keys(trustDimensions).forEach(key => {
          trustDimensions[key] = Math.max(15, Math.min(100, trustDimensions[key]));
        });
        const total = Math.round(Object.entries(trustDimensions).reduce((sum, [key, value]) => {
          return sum + value * TrustDimensionMeta[key].weight / 100;
        }, 0));
        return {
          score: total,
          level: total >= 80 ? "高" : total >= 65 ? "中等偏高" : total >= 50 ? "中等" : total >= 35 ? "中等偏低" : "低",
          dimensions: trustDimensions
        };
      }
    };

    const RewriteEngine = {
      replacements: [
        [/姐妹们闭眼入/g, "如果你正在关注这类需求，可以先了解这款产品"],
        [/闭眼入/g, "可以结合自身需求了解"],
        [/真的太神了/g, "使用体验比较有特点"],
        [/3天就能白一个度|三天就能白一个度/g, "部分用户反馈持续使用后肤感更清爽"],
        [/30天英语成绩必定提高/g, "适合希望系统提升英语学习效率的用户参考"],
        [/全网第一|全行业第一/g, "较受关注"],
        [/美白神器/g, "提亮护理产品"],
        [/敏感肌也100%能用/g, "敏感肌用户建议先进行局部测试"],
        [/推荐给所有朋友/g, "分享给有类似需求的朋友"],
        [/再不买就亏大了/g, "可以根据实际需求理性选择"],
        [/最后3个名额/g, "名额情况以页面显示为准"],
        [/今天不报就没机会了/g, "可在活动期内了解课程安排"],
        [/喝了就能瘦/g, "可作为日常饮食管理的参考选择"],
        [/0负担0风险/g, "建议结合自身情况选择"],
        [/明星同款/g, "产品风格较受关注"],
        [/全网最低价/g, "活动价以官方页面为准"],
        [/只要坚持一周就能看到明显变化/g, "具体体验因人而异"]
      ],
      rewriteSentence(sentence, item, style) {
        let output = sentence;
        this.replacements.forEach(([pattern, value]) => {
          output = output.replace(pattern, value);
        });
        if (output === sentence && item) {
          output = `${sentence.replace(/[！!]+/g, "。")} 建议调整为更克制、可验证的表达，并补充适用条件。`;
        }
        if (style === "safe") {
          return output
            .replace(/太神了/g, "体验较有特点")
            .replace(/马上/g, "持续使用后可能")
            .replace(/必定/g, "可能")
            .replace(/一定/g, "可能")
            .replace(/所有/g, "部分");
        }
        if (style === "balanced") {
          return output
            .replace(/可以结合自身需求了解/g, "如果你正在关注这类需求，可以重点了解")
            .replace(/部分用户反馈/g, "不少用户关注")
            .replace(/建议结合自身情况选择/g, "更适合作为日常选择时的参考")
            .replace(/理性选择/g, "在活动期内按需选择");
        }
        return output
          .replace(/闭眼入/g, "值得按需了解")
          .replace(/亏大了/g, "可能会错过当前活动")
          .replace(/神器/g, "亮点产品")
          .replace(/必定/g, "有机会")
          .replace(/100%/g, "建议结合实际情况");
      },
      build(text, riskItems) {
        const sentences = TextToolkit.splitSentences(text);
        const itemMap = new Map(riskItems.map(item => [item.sentence, item]));
        const compose = style => sentences.map(sentence => this.rewriteSentence(sentence, itemMap.get(sentence), style)).join("");
        let safeVersion = compose("safe");
        let balancedVersion = compose("balanced");
        let originalStyleVersion = compose("style");
        if (!riskItems.length) {
          safeVersion = `${text} 建议结合自身情况选择，具体信息以官方页面或实际说明为准。`;
          balancedVersion = `${text} 可以补充适用人群、使用场景和信息来源，让表达更完整可信。`;
          originalStyleVersion = `${text} 信息以官方页面为准，建议按自身需求理性选择。`;
        }
        if (riskItems.length && safeVersion === text) safeVersion = `${text} 建议弱化确定性表达，并补充适用条件和证据来源。`;
        if (riskItems.length && balancedVersion === text) balancedVersion = `${text} 建议保留核心卖点，同时删除无法证明的承诺表达。`;
        if (riskItems.length && originalStyleVersion === text) originalStyleVersion = `${text} 建议保留原有语气，但替换绝对化和过度承诺词。`;
        return {
          safeVersion,
          balancedVersion,
          originalStyleVersion,
          rewriteNotes: this.buildNotes(riskItems)
        };
      },
      buildNotes(riskItems) {
        const types = new Set(riskItems.flatMap(item => item.riskTypes));
        const notes = [];
        if (types.has("绝对化表达")) notes.push("删除或弱化绝对化排名和确定性表述。");
        if (types.has("夸大效果") || types.has("功效承诺")) notes.push("弱化功效承诺，补充效果因人而异和适用条件。");
        if (types.has("证据不足")) notes.push("补充证据来源或删除无法证明的权威背书。");
        if (types.has("价格误导")) notes.push("明确价格活动规则、时间范围和库存依据。");
        if (types.has("广告属性不透明")) notes.push("补充推广、合作或购买引导关系说明。");
        if (types.has("焦虑营销")) notes.push("减少强促销和焦虑话术，改为理性推荐。");
        if (!notes.length) notes.push("未发现明显高风险表达，已补充更可信的适用条件和信息来源提示。");
        return notes;
      }
    };

    const SuggestionEngine = {
      build(riskItems) {
        const types = new Set(riskItems.flatMap(item => item.riskTypes));
        const suggestions = [];
        if (types.has("证据不足")) suggestions.push("补充数据来源、检测报告、统计口径、专家身份或背书依据。");
        if (types.has("广告属性不透明")) suggestions.push("如果内容包含合作、试用、赞助或购买链接，建议明确说明推广关系。");
        if (types.has("绝对化表达")) suggestions.push("弱化“第一、最好、100%”等绝对化表达，改用更克制的相对描述。");
        if (types.has("夸大效果") || types.has("功效承诺")) suggestions.push("删除确定性效果承诺，增加“具体效果因人而异”的适用条件提示。");
        if (types.has("价格误导")) suggestions.push("明确活动时间、库存数量和价格对比口径，避免制造虚假稀缺感。");
        if (types.has("用户评价滥用")) suggestions.push("避免用个别体验代表所有用户，必要时说明样本来源和反馈范围。");
        if (types.has("焦虑营销")) suggestions.push("把强刺激话术调整为理性推荐，保留卖点但减少压力感。");
        if (!suggestions.length) suggestions.push("当前文本风险较低，建议继续补充真实证据和适用条件，提高品牌可信度。");
        return suggestions;
      },
      checklist(riskItems) {
        const types = new Set(riskItems.flatMap(item => item.riskTypes));
        return [
          ["是否不存在绝对化表达", !types.has("绝对化表达")],
          ["是否不存在功效承诺", !types.has("功效承诺")],
          ["是否提供数据来源或证据依据", !types.has("证据不足")],
          ["是否标明广告、合作或购买引导关系", !types.has("广告属性不透明")],
          ["是否不存在价格误导或虚假稀缺", !types.has("价格误导")],
          ["是否避免虚构用户、专家或测评场景", !types.has("内容真实性风险")],
          ["是否避免焦虑营销", !types.has("焦虑营销")],
          ["是否保留真实、克制、可验证的表达", riskItems.length <= 2]
        ].map(([item, passed]) => ({ item, passed }));
      }
    };

    const ReportGenerator = {
      publishSuggestion(level) {
        if (level === "低风险") return "基本可发布，建议补充证据和适用条件后再确认。";
        if (level === "中风险") return "建议修改部分表达后发布。";
        if (level === "高风险") return "存在明显不稳妥表达，建议重点修改后再发布。";
        return "不建议直接发布，需要重写关键卖点和承诺表达。";
      },
      buildSummary(risk, trust, riskItems) {
        const riskCount = {
          high: riskItems.filter(item => item.riskLevel === "高").length,
          medium: riskItems.filter(item => item.riskLevel === "中").length,
          low: riskItems.filter(item => item.riskLevel === "低").length
        };
        return {
          riskScore: risk.score,
          riskLevel: risk.level,
          trustScore: trust.score,
          trustLevel: trust.level,
          publishSuggestion: this.publishSuggestion(risk.level),
          topRisks: this.topRisks(riskItems),
          riskCount
        };
      },
      topRisks(riskItems) {
        const candidates = [];
        const types = new Set(riskItems.flatMap(item => item.riskTypes));
        if (types.has("功效承诺") || types.has("夸大效果")) candidates.push("存在确定性功效承诺，容易造成消费者误解。");
        if (types.has("证据不足")) candidates.push("权威背书或效果数据缺少来源，证据支撑不足。");
        if (types.has("焦虑营销") || types.has("价格误导")) candidates.push("使用强促销和焦虑话术，可能削弱品牌可信度。");
        if (types.has("广告属性不透明")) candidates.push("广告或购买引导关系不够透明，影响消费者判断。");
        if (types.has("绝对化表达")) candidates.push("存在绝对化排名或承诺表达，发布前需要重点修改。");
        return candidates.slice(0, 3);
      },
      markdown(result) {
        const risks = result.riskItems.length
          ? result.riskItems.map((item, index) => `${index + 1}. ${item.sentence}\n   - 风险类型：${item.riskTypes.join("、")}\n   - 风险等级：${item.riskLevel}\n   - 影响维度：${item.affectedDimensionLabels.join("、")}\n   - 风险原因：${item.reason}\n   - 需要补充的证据：${item.evidenceNeeded || "暂无"}\n   - 建议改写：${item.rewrite}`).join("\n")
          : "暂无明显信任阻碍点。";
        const riskDimensions = Object.entries(result.dimensionScores.riskDimensions).map(([key, value]) => `- ${RiskDimensionMeta[key].label}：${value}/100`).join("\n");
        const trustDimensions = Object.entries(result.dimensionScores.trustDimensions).map(([key, value]) => `- ${TrustDimensionMeta[key].label}：${value}/100`).join("\n");
        const topRisks = result.summary.topRisks.length ? result.summary.topRisks.map(item => `- ${item}`).join("\n") : "- 暂无明显主要风险。";
        const suggestions = result.trustSuggestions.map(item => `- ${item}`).join("\n");
        const checklist = result.checklist.map(item => `- ${item.passed ? "通过" : "需修改"}：${item.item}`).join("\n");
        const notes = result.rewrites.rewriteNotes.map(item => `- ${item}`).join("\n");

        return `# AdTrust AI 信任转化优化报告

## 1. 基本信息
- 内容类型：${result.basicInfo.contentType}
- 行业类别：${result.basicInfo.industry}
- 内容目的：${result.basicInfo.intent}
- 目标受众：${result.basicInfo.targetAudienceGuess}
- 分析模式：${result.basicInfo.mode}

## 2. 综合结论
- 综合风险等级：${result.summary.riskLevel}
- 合规安全度：${Math.max(0, 100 - result.summary.riskScore)}/100
- 品牌信任分：${result.summary.trustScore}/100
- 品牌信任等级：${result.summary.trustLevel}
- 营销优化建议：${result.summary.publishSuggestion}
- 高风险数量：${result.summary.riskCount.high}
- 中风险数量：${result.summary.riskCount.medium}
- 低风险数量：${result.summary.riskCount.low}

## 3. 合规底线维度
${riskDimensions}

## 4. 品牌信任维度评分
${trustDimensions}

## 5. 主要信任阻碍摘要
${topRisks}

## 6. 逐句信任阻碍标注
${risks}

## 7. 多风格改写结果
### 高信任版
${result.rewrites.safeVersion}

### 高转化版
${result.rewrites.balancedVersion}

### 原风格优化版
${result.rewrites.originalStyleVersion}

### 改写说明
${notes}

## 8. 信任增强建议
${suggestions}

## 9. 信任与合规底线清单
${checklist}

## 10. 免责声明
${result.disclaimer}`;
      }
    };

    const AuditOrchestrator = {
      run(request) {
        const basicInfo = ContentClassifier.analyze(request);
        const riskItems = LocalRuleEngine.detect(request.text);
        riskItems.forEach(item => {
          item.rewrite = RewriteEngine.rewriteSentence(item.sentence, item, "balanced");
        });
        const risk = ScoringModel.scoreRisk(riskItems);
        const trust = ScoringModel.scoreTrust(risk.score, riskItems);
        const rewrites = RewriteEngine.build(request.text, riskItems);
        const summary = ReportGenerator.buildSummary(risk, trust, riskItems);
        const dimensionScores = {
          riskDimensions: risk.dimensions,
          trustDimensions: trust.dimensions
        };
        const result = {
          id: `audit-${Date.now()}`,
          createdAt: new Date().toISOString(),
          originalText: request.text,
          request,
          promptPreview: PromptTemplateModule.buildUserPrompt(request),
          basicInfo,
          summary,
          dimensionScores,
          riskItems,
          risk,
          trust,
          rewrites,
          trustSuggestions: SuggestionEngine.build(riskItems),
          checklist: SuggestionEngine.checklist(riskItems),
          disclaimer: "本报告仅用于营销内容风险提示、消费者信任分析和文本优化建议，不构成法律意见或平台审核结论。正式发布前，建议结合企业内部规范、平台规则和专业意见进行复核。"
        };
        result.markdownReport = ReportGenerator.markdown(result);
        return result;
      }
    };

    const MarketingOptimizer = {
      audienceLabels: {
        auto: "自动推断",
        student: "学生党",
        white_collar: "精致白领",
        ingredient: "成分党",
        price_sensitive: "价格敏感型",
        result_oriented: "功效导向型",
        beginner: "新手小白",
        expert: "专业达人",
        mom: "宝妈人群",
        senior: "银发人群",
        other: "其他"
      },
      platformLabels: {
        xiaohongshu: "小红书",
        douyin: "抖音",
        shipinhao: "视频号",
        tmall: "淘宝/天猫",
        jd: "京东",
        wechat: "微信私域",
        offline: "线下海报",
        general: "通用"
      },
      run(request) {
        const frictionItems = LocalRuleEngine.detect(request.text || request.imageText || request.sellingPoints || "");
        const consumerProfile = this.buildConsumerProfile(request);
        const metrics = this.score(request, frictionItems);
        const rewrites = this.rewrite(request, frictionItems);
        const result = {
          id: `opt-${Date.now()}`,
          createdAt: new Date().toISOString(),
          originalText: request.text,
          request,
          consumerProfile,
          metrics,
          summary: {
            marketingConclusion: this.conclusion(metrics, request),
            trustScore: metrics.trustScore,
            conversionAppeal: metrics.conversionAppeal,
            audienceFit: metrics.audienceFit,
            sellingPointClarity: metrics.sellingPointClarity,
            complianceSafety: metrics.complianceSafety
          },
          frictionItems: this.buildFrictionItems(frictionItems),
          conversionLosses: this.conversionLosses(request, metrics),
          circlePreference: this.circlePreference(request),
          complianceReminders: this.complianceReminders(frictionItems),
          rewrites,
          markdownReport: "",
          disclaimer: "本报告仅用于营销内容风险提示、消费者信任分析和文本优化建议，不构成法律意见或平台审核结论。正式发布前，建议结合企业内部规范、平台规则和专业意见进行复核。"
        };
        result.markdownReport = this.markdown(result);
        result.notice = "当前为第一批前端优化版本，图片识别暂以预览和手动录入文字为准。";
        return result;
      },
      buildConsumerProfile(request) {
        const audience = request.targetAudience === "auto" ? this.inferAudience(request) : this.audienceLabels[request.targetAudience];
        const category = FieldLabels.industry[request.productCategory] || "其他";
        return {
          inferredAudience: audience,
          motivation: request.adGoal === "promotion" ? "希望在明确权益下快速做出购买决策" : "希望先建立理解和信任，再判断是否值得尝试",
          priceSensitivity: /低价|优惠|折扣|活动|赠品|学生|性价比/.test(`${request.priceRange} ${request.sellingPoints} ${request.text}`) ? "较高" : "中等",
          mainConcerns: request.proofMaterials ? "效果是否真实、材料是否可信、是否适合自己" : "证据不足、效果不确定、购买理由是否充分",
          preferredTone: this.circlePreference(request).preferredExpression,
          purchaseTrigger: request.adGoal === "promotion" ? "明确权益、活动规则和立即行动理由" : "真实体验、清晰卖点和可验证依据",
          category
        };
      },
      inferAudience(request) {
        const text = `${request.productName} ${request.productCategory} ${request.priceRange} ${request.sellingPoints} ${request.text}`;
        if (/成分|配方|参数|检测|报告/.test(text)) return "成分党";
        if (/学生|平价|预算|性价比/.test(text)) return "学生党";
        if (/通勤|精致|效率|质感/.test(text)) return "精致白领";
        if (/宝妈|孩子|家庭|安全/.test(text)) return "宝妈人群";
        return "功效导向型";
      },
      score(request, frictionItems) {
        const text = `${request.productName} ${request.sellingPoints} ${request.proofMaterials} ${request.text} ${request.imageText}`;
        const hasProof = !!request.proofMaterials.trim();
        const hasCta = /下单|领取|咨询|预约|点击|私信|到店|购买|报名|锁定/.test(text);
        const hasEmotion = /焦虑|省心|安心|舒服|适合|通勤|场景|问题|需求|体验/.test(text);
        const clarityBase = request.sellingPoints.trim().length > 12 ? 78 : 55;
        const frictionPenalty = frictionItems.length * 7;
        return {
          trustScore: clamp((hasProof ? 82 : 62) - frictionPenalty + (request.complianceStrength === "strict" ? 6 : 0)),
          conversionAppeal: clamp((hasCta ? 78 : 58) + (request.marketingStyle === "conversion" ? 10 : 0) + (hasEmotion ? 6 : 0)),
          audienceFit: clamp((request.targetAudience !== "auto" ? 76 : 66) + (request.targetPlatform !== "general" ? 8 : 0)),
          sellingPointClarity: clamp(clarityBase + (request.productName ? 6 : 0)),
          complianceSafety: clamp(88 - frictionPenalty + (request.complianceStrength === "strict" ? 8 : request.complianceStrength === "loose" ? -6 : 0))
        };
      },
      buildFrictionItems(riskItems) {
        if (!riskItems.length) {
          return [{
            name: "证明材料表达仍可加强",
            trustImpact: "消费者可能理解卖点，但缺少进一步确认依据。",
            conversionImpact: "会降低临门一脚的购买信心。",
            complianceBaseline: "否",
            suggestion: "补充用户反馈、活动规则、成分说明或真实使用场景。"
          }];
        }
        return riskItems.map(item => ({
          name: item.riskTypes[0] || "信任阻碍点",
          trustImpact: item.reason,
          conversionImpact: "可能让消费者产生怀疑，降低继续了解或购买的意愿。",
          complianceBaseline: item.riskLevel === "高" ? "是" : "可能涉及",
          suggestion: item.rewrite
        }));
      },
      conversionLosses(request, metrics) {
        const losses = [];
        if (metrics.sellingPointClarity < 70) losses.push("卖点不够清晰，用户难以快速理解产品价值。");
        if (metrics.conversionAppeal < 70) losses.push("行动召唤偏弱，缺少明确下一步动作。");
        if (!request.proofMaterials.trim()) losses.push("证明材料不足，可信度支撑不够。");
        if (metrics.audienceFit < 72) losses.push("圈层语言不够精准，目标人群代入感不足。");
        if (!losses.length) losses.push("当前转化链路较完整，建议继续强化证据和平台表达细节。");
        return losses;
      },
      circlePreference(request) {
        const audience = request.targetAudience === "auto" ? this.inferAudience(request) : this.audienceLabels[request.targetAudience];
        const map = {
          "成分党": ["清晰成分、参数依据、检测来源", "夸张效果、空泛背书", "成分、浓度、检测、适用肤质", "理性、具体、证据优先"],
          "学生党": ["性价比、真实体验、低试错成本", "高压促销、过度制造焦虑", "平价、预算友好、通勤、入门", "轻松、直接、有生活感"],
          "精致白领": ["效率、质感、稳定体验", "廉价感、强吆喝", "省心、质感、通勤、稳定", "克制、专业、品牌感"],
          "宝妈人群": ["安全、口碑、适用条件", "绝对化安全承诺", "安心、温和、适合家庭", "可靠、清楚、有边界"],
          "功效导向型": ["明确问题、改善路径、可验证反馈", "过度承诺、无依据见效", "改善、反馈、周期、适用条件", "结果清晰但不过度承诺"]
        };
        const data = map[audience] || map["功效导向型"];
        return {
          audience,
          likes: data[0],
          dislikes: data[1],
          matchLevel: request.targetAudience === "auto" ? "中等" : "中等偏高",
          recommendedKeywords: data[2],
          preferredExpression: data[3]
        };
      },
      complianceReminders(frictionItems) {
        return frictionItems.length
          ? frictionItems.map(item => `避免保留“${item.name || "信任阻碍表达"}”相关的不确定表达，补充可验证依据。`).slice(0, 4)
          : ["合规底线问题较少，但仍建议发布前复核平台规则、活动规则和证明材料。"];
      },
      rewrite(request, frictionItems) {
        const product = request.productName || "这款产品";
        const points = request.sellingPoints.trim() || "核心卖点清晰，适合有相关需求的人群";
        const proof = request.proofMaterials.trim() || "建议结合官方说明、真实反馈和自身需求判断";
        const platform = this.platformLabels[request.targetPlatform] || "通用";
        return {
          highTrustVersion: `${product}主打${points.replace(/\n/g, "、")}。如果你正在比较同类产品，可以先关注它的适用场景、使用条件和相关依据。${proof}，具体体验建议以个人实际情况为准。`,
          highConversionVersion: `如果你正在寻找${points.split("\n")[0] || "更合适的选择"}，可以优先了解${product}。当前重点权益和适用理由已经比较明确，建议先确认需求是否匹配，再根据活动规则完成下一步咨询或购买。`,
          seedingRealVersion: `最近在看同类产品时，${product}比较值得放进备选。它吸引我的点是${points.split("\n").slice(0, 2).join("、") || "卖点比较清楚"}，不是所有人都一定适合，但如果你的需求接近，可以结合评价和说明再判断。`,
          gentleUrgencyVersion: `这轮活动适合已经在比较同类产品的人先锁定权益。建议先看清${product}的适用条件、活动规则和证明材料，确认符合自己的需求后再决定是否参与。`,
          platformVersion: this.platformRewrite(platform, product, points, proof),
          rewriteDiff: [
            "删除或弱化不可信的绝对化表达。",
            "保留活动权益、使用场景和购买理由。",
            "补充适用条件、证明材料和官方说明口径。",
            "根据目标平台调整语气和信息密度。",
            "保留合规底线，不输出无法证明的承诺。"
          ],
          versionMeta: {
            highTrustVersion: ["品牌官方、详情页", "理性比较型消费者", "保留产品价值和证明材料", "降低证据不足和夸张承诺", "先建立可信依据，再引导了解"],
            highConversionVersion: ["促销、私域、电商", "有明确需求的人群", "保留权益和行动召唤", "降低强压迫感", "用购买理由推动下一步动作"],
            seedingRealVersion: ["小红书、短视频口播", "新手小白、种草用户", "保留体验感和真实语气", "降低广告感", "用真实场景建立兴趣"],
            gentleUrgencyVersion: ["活动页、直播预告、私域", "已在比较的人群", "保留限时感", "降低虚假稀缺", "把紧迫感解释为具体活动规则"],
            platformVersion: [platform, "平台目标消费者", "保留平台表达节奏", "降低平台不适配表达", "按平台语境组织卖点"]
          }
        };
      },
      platformRewrite(platform, product, points, proof) {
        if (platform === "小红书") return `做了一轮同类对比后，${product}比较适合先收藏。它的核心亮点是${points.replace(/\n/g, "、")}，建议结合自己的需求和真实反馈再判断。`;
        if (platform === "抖音") return `先说结论：如果你正在找一款卖点清楚、适用场景明确的产品，${product}可以重点看。核心利益点是${points.replace(/\n/g, "、")}，下单前记得确认活动规则。`;
        if (platform === "微信私域") return `给大家一个理性参考：${product}适合有相关需求的人先了解。卖点是${points.replace(/\n/g, "、")}，证明材料可参考：${proof}。需要的话可以先确认是否匹配。`;
        return `${product}的核心价值是${points.replace(/\n/g, "、")}。建议结合${proof}进行判断，并根据目标平台调整表达节奏和行动入口。`;
      },
      conclusion(metrics, request) {
        if (metrics.trustScore < 65 && metrics.conversionAppeal >= 70) return "当前文案信任感不足，但具备一定转化潜力，建议保留紧迫感，同时补充真实依据。";
        if (metrics.conversionAppeal >= 75 && metrics.audienceFit < 70) return "当前文案吸引力较强，但目标人群不够精准，建议强化目标圈层语言。";
        if (metrics.complianceSafety < 70) return "当前文案促销氛围较好，但证明材料或表达边界不足，建议补充活动规则和真实反馈。";
        return "当前文案具备基础信任感和转化潜力，建议进一步强化目标人群语言和购买理由。";
      },
      markdown(result) {
        return `# AdTrust AI 消费者信任与广告转化优化报告\n\n## 营销优化结论\n${result.summary.marketingConclusion}\n\n## 五项核心指标\n- 消费者信任度：${result.metrics.trustScore}\n- 转化吸引力：${result.metrics.conversionAppeal}\n- 圈层匹配度：${result.metrics.audienceFit}\n- 卖点清晰度：${result.metrics.sellingPointClarity}\n- 合规安全度：${result.metrics.complianceSafety}\n\n## 消费者画像\n- 推断目标人群：${result.consumerProfile.inferredAudience}\n- 消费动机：${result.consumerProfile.motivation}\n- 主要顾虑：${result.consumerProfile.mainConcerns}\n\n## 信任阻碍点\n${result.frictionItems.map(item => `- ${item.name}：${item.suggestion}`).join("\n")}\n\n## 多风格改写\n### 高信任版\n${result.rewrites.highTrustVersion}\n\n### 高转化版\n${result.rewrites.highConversionVersion}\n\n### 种草真实版\n${result.rewrites.seedingRealVersion}\n\n### 温和紧迫版\n${result.rewrites.gentleUrgencyVersion}\n\n### 平台适配版\n${result.rewrites.platformVersion}\n\n## 免责声明\n${result.disclaimer}`;
      }
    };

    function clamp(value) {
      return Math.max(0, Math.min(100, Math.round(value)));
    }

    const AuditService = {
      async audit(request) {
        try {
          const result = await auditAd(this.toApiRequest(request));
          return this.normalizeApiResult(result, request);
        } catch (error) {
          const fallback = MarketingOptimizer.run(request);
          fallback.notice = "当前为本地演示模式，配置 DeepSeek 后可获得深度分析。";
          return fallback;
        }
      },
      async extractImage(image) {
        try {
          return requestImageExtract(image);
        } catch (error) {
          return {
            imageText: "",
            visualDescription: "图片识别暂不可用，请手动输入图片中的文字。",
            marketingObservations: ["请手动补充主标题、价格权益和行动按钮信息。"],
            provider: "manualFallback"
          };
        }
      },
      async rewriteChat({ auditResult, currentCopy, userMessage, history }) {
        return requestRewriteChat({ auditResult, currentCopy, userMessage, history });
      },
      toApiRequest(request) {
        const imageTexts = Array.from(new Set([
          ...((request.images || []).map(image => image.imageText).filter(Boolean)),
          request.imageText
        ].filter(Boolean)));
        const imageDescriptions = (request.images || [])
          .map(image => image.visualDescription || `${image.name}，图片类型：${request.imageType}`)
          .filter(Boolean);
        return {
          product: {
            name: request.productName,
            category: FieldLabels.industry[request.productCategory] || "其他",
            priceRange: request.priceRange,
            sellingPoints: request.sellingPoints.split(/\n|；|;/).map(item => item.trim()).filter(Boolean),
            proofMaterials: request.proofMaterials.split(/\n|；|;/).map(item => item.trim()).filter(Boolean)
          },
          creative: {
            text: request.text,
            imageTexts,
            imageDescriptions,
            objective: this.objectiveLabel(request.adGoal)
          },
          context: {
            platform: MarketingOptimizer.platformLabels[request.targetPlatform] || "通用",
            targetAudience: MarketingOptimizer.audienceLabels[request.targetAudience] || "自动推断",
            marketingStyle: this.styleLabel(request.marketingStyle),
            complianceMode: request.complianceStrength
          }
        };
      },
      objectiveLabel(value) {
        return {
          seeding: "种草",
          promotion: "促销转化",
          live: "直播带货",
          launch: "新品上市",
          trust_repair: "品牌信任修复",
          private_conversion: "私域社群转化"
        }[value] || "种草";
      },
      styleLabel(value) {
        return {
          seeding: "真实种草",
          trustworthy: "专业可信",
          conversion: "高转化促销",
          gentle_urgency: "温和紧迫",
          emotional: "情绪共鸣",
          premium: "高级品牌感",
          young: "年轻化口语",
          live_interactive: "直播间强互动"
        }[value] || "专业可信";
      },
      normalizeApiResult(result, request) {
        if (result.metrics && result.consumerProfile) return result;
        const scores = result.scores || {};
        const insight = result.consumerInsight || {};
        const diagnosis = result.diagnosis || {};
        const basic = result.basicInfo || {};
        const rewrites = result.rewrites || {};
        const imageAnalysis = result.imageAnalysis || diagnosis.imageAnalysis || {};
        return {
          id: result.id || `audit-${Date.now()}`,
          createdAt: result.createdAt || new Date().toISOString(),
          originalText: request.text,
          request,
          summary: { marketingConclusion: this.marketingConclusion(scores) },
          metrics: {
            trustScore: scores.trustScore || 0,
            conversionAppeal: scores.conversionAppeal || 0,
            audienceFit: scores.audienceFit || 0,
            sellingPointClarity: scores.sellingPointClarity || 0,
            complianceSafety: scores.complianceSafety || 0
          },
          consumerProfile: {
            inferredAudience: basic.detectedAudience || insight.persona || "自动推断",
            motivation: insight.purchaseMotivation || "希望先建立信任，再判断是否值得尝试",
            priceSensitivity: request.priceRange ? "中等" : "待判断",
            mainConcerns: (insight.mainObjections || []).join("、") || "证据是否充分、是否适合自己",
            preferredTone: (insight.preferredLanguage || []).join("、"),
            purchaseTrigger: (insight.purchaseTriggers || []).join("、"),
            category: basic.category || FieldLabels.industry[request.productCategory] || "其他"
          },
          circlePreference: {
            audience: basic.detectedCircle || basic.detectedAudience || "目标消费者",
            likes: insight.circlePreference || "偏好真实、具体、有依据的表达",
            dislikes: "无证据承诺、虚假稀缺和过度硬广",
            matchLevel: (scores.audienceFit || 0) >= 75 ? "中等偏高" : "中等",
            recommendedKeywords: (insight.preferredLanguage || []).join("、") || "真实、场景、适用条件",
            preferredExpression: insight.circlePreference || "真实、具体、有行动入口"
          },
          frictionItems: (diagnosis.trustBarriers || []).map(item => typeof item === "string" ? {
            name: item,
            trustImpact: item,
            conversionImpact: "可能降低继续了解和购买的意愿。",
            complianceBaseline: "可能涉及",
            suggestion: "补充真实依据并重写表达。"
          } : {
            name: item.name || "信任阻碍点",
            trustImpact: item.impactOnTrust || item.reason || "",
            conversionImpact: item.impactOnConversion || "可能降低转化意愿。",
            complianceBaseline: item.complianceRelated ? "是" : "否",
            suggestion: item.suggestion || ""
          }),
          conversionLosses: diagnosis.conversionBlockers || [],
          complianceReminders: diagnosis.complianceGuardrails || [],
          imageAnalysis,
          caseReferences: result.caseReferences || [],
          legalReferences: result.legalReferences || [],
          platformReferences: result.platformReferences || result.diagnosis?.platformAdaptation || [],
          platformAdaptation: result.diagnosis?.platformAdaptation || [],
          rewrites: {
            highTrustVersion: rewrites.highTrustVersion || "",
            highConversionVersion: rewrites.highConversionVersion || "",
            seedingRealVersion: rewrites.seedingVersion || "",
            gentleUrgencyVersion: rewrites.softUrgencyVersion || "",
            platformVersion: rewrites.platformAdaptedVersion || "",
            rewriteDiff: result.rewriteRationales || [],
            versionMeta: this.versionMeta(result, request)
          },
          chatStarters: result.chatStarters || [],
          markdownReport: result.markdownReport || "",
          disclaimer: result.disclaimer || "本报告仅用于广告信任与转化优化、消费者理解分析和文本改写建议，不构成法律意见或平台审核结论。",
          notice: result.notice || ""
        };
      },
      marketingConclusion(scores) {
        if ((scores.trustScore || 0) < 65 && (scores.conversionAppeal || 0) >= 70) return "当前文案信任感不足，但具备一定转化潜力，建议保留紧迫感，同时补充真实依据。";
        if ((scores.conversionAppeal || 0) >= 75 && (scores.audienceFit || 0) < 70) return "当前文案吸引力较强，但目标人群不够精准，建议强化目标圈层语言。";
        if ((scores.complianceSafety || 0) < 70) return "当前文案促销氛围较好，但证明材料或表达边界不足，建议补充活动规则和真实反馈。";
        return "当前文案具备基础信任感和转化潜力，建议进一步强化目标人群语言和购买理由。";
      },
      versionMeta(result, request) {
        const audience = result.basicInfo?.detectedAudience || "目标消费者";
        const platform = result.basicInfo?.platform || MarketingOptimizer.platformLabels[request.targetPlatform] || "通用";
        return {
          highTrustVersion: ["品牌官方、详情页", audience, "保留产品价值和证明材料", "降低证据不足", "先建立可信依据，再引导了解"],
          highConversionVersion: ["促销、私域、电商", audience, "保留权益和行动召唤", "降低虚假稀缺", "用购买理由推动下一步动作"],
          seedingRealVersion: ["小红书、短视频口播", audience, "保留体验感", "降低广告感", "用真实场景建立兴趣"],
          gentleUrgencyVersion: ["活动页、直播预告、私域", audience, "保留限时感", "降低压力销售", "把紧迫感解释为具体活动规则"],
          platformVersion: [platform, audience, "保留平台表达节奏", "降低平台不适配表达", "按平台语境组织卖点"]
        };
      },
      normalizeResult(result, request) {
        result.originalText = result.originalText || request.text;
        result.request = result.request || request;
        result.disclaimer = result.disclaimer || "本报告仅用于营销内容风险提示、消费者信任分析和文本优化建议，不构成法律意见或平台审核结论。正式发布前，建议结合企业内部规范、平台规则和专业意见进行复核。";
        if (!result.markdownReport) result.markdownReport = ReportGenerator.markdown(result);
        if (result.riskItems) {
          result.riskItems = result.riskItems.map((item, index) => ({
            id: item.id || `risk-${index + 1}`,
            sentence: item.sentence || "",
            riskTypes: item.riskTypes || [],
            riskLevel: item.riskLevel || "中",
            affectedDimensions: item.affectedDimensions || [],
            affectedDimensionLabels: item.affectedDimensionLabels || (item.affectedDimensions || []).map(key => RiskDimensionMeta[key]?.label || key),
            reason: item.reason || "该表达在当前语境下可能影响消费者理解。",
            evidenceNeeded: item.evidenceNeeded || "相关事实依据",
            rewrite: item.rewrite || RewriteEngine.rewriteSentence(item.sentence || "", item, "balanced")
          }));
        }
        return result;
      }
    };

    const UI = {
      appState: structuredClone(initialAppState),
      workflow: createWorkflowStore(),
      processStep: 0,
      init() {
        initHomePage();
        initWorkflowPage();
        initReportPage();
        initRewriteStudio();
        initExamplesPage();
        initAboutPage();
        this.bindEvents();
        this.updateCharCount();
        this.loadHistory();
        this.renderProcess("idle");
        this.renderSimulationCases();
        this.renderExamples();
        this.renderAbout();
        this.renderHistory();
        this.renderDeepSeekStatus();
        this.loadKnowledgeBases();
        if (this.appState.history[0]) {
          this.appState.result = this.appState.history[0].result;
          this.renderReport(this.appState.result);
          this.renderRewrite(this.appState.result);
        }
      },
      bindEvents() {
        document.body.addEventListener("click", event => {
          const pageButton = event.target.closest("[data-page]");
          if (pageButton) this.switchPage(pageButton.dataset.page);

          const enterSimulation = event.target.closest("[data-enter-simulation]");
          if (enterSimulation) this.enterSimulationMode();

          const exitSimulation = event.target.closest("[data-exit-simulation]");
          if (exitSimulation) this.exitSimulationMode();

          const simulationCase = event.target.closest("[data-simulation-case]");
          if (simulationCase) this.loadSimulationCase(simulationCase.dataset.simulationCase);

          const simulationStart = event.target.closest("[data-simulation-start]");
          if (simulationStart) this.submitAudit();

          const stageButton = event.target.closest("[data-stage]");
          if (stageButton) this.switchStage(stageButton.dataset.stage);

          const sampleButton = event.target.closest("[data-load-sample]");
          if (sampleButton) this.loadSample(Number(sampleButton.dataset.loadSample));

          const caseApplyButton = event.target.closest("[data-case-apply]");
          if (caseApplyButton) this.applyCasePattern(caseApplyButton.dataset.caseApply);

          const caseDetailButton = event.target.closest("[data-case-detail]");
          if (caseDetailButton) this.selectCase(caseDetailButton.dataset.caseDetail);

          const historyButton = event.target.closest("[data-history-id]");
          if (historyButton) this.loadHistoryResult(historyButton.dataset.historyId);

          const choiceButton = event.target.closest(".option-card[data-value]");
          if (choiceButton) this.chooseOption(choiceButton);

          const copyButton = event.target.closest("[data-copy]");
          if (copyButton && this.appState.result) this.copyByKey(copyButton.dataset.copy);

          const downloadButton = event.target.closest("[data-download]");
          if (downloadButton && this.appState.result) this.downloadMarkdown(downloadButton.dataset.download);

          const presentationButton = event.target.closest("#presentationBtn, #presentationExitBtn");
          if (presentationButton) this.togglePresentationMode();

          const chatStarter = event.target.closest("[data-chat-starter]");
          if (chatStarter) this.applyChatStarter(chatStarter.dataset.chatStarter, true);

          const chatSend = event.target.closest("#rewriteChatSend");
          if (chatSend) this.sendRewriteChat();

          const rewriteTab = event.target.closest("[data-rewrite-tab]");
          if (rewriteTab) this.selectRewriteTab(rewriteTab.dataset.rewriteTab);

          const setFinal = event.target.closest("[data-set-final]");
          if (setFinal) this.setFinalVersion(setFinal.dataset.setFinal);

          const generateFinal = event.target.closest("[data-generate-final]");
          if (generateFinal) this.generateFinalVersion();

          const enterRewrite = event.target.closest("[data-enter-rewrite]");
          if (enterRewrite) this.enterRewriteStudio();

          const rediagnose = event.target.closest("[data-rediagnose]");
          if (rediagnose) this.submitAudit();

          const regenerate = event.target.closest("[data-regenerate]");
          if (regenerate) this.regenerateRewrite();

          const removeImage = event.target.closest("[data-remove-image]");
          if (removeImage) this.removeImage(Number(removeImage.dataset.removeImage));
        });

        document.body.addEventListener("input", event => {
          const caseFilter = event.target.closest("[data-case-filter]");
          if (caseFilter) this.updateCaseFilter(caseFilter.dataset.caseFilter, caseFilter.value);

          const imageText = event.target.closest("[data-image-text-index]");
          if (imageText) this.updateImageField(Number(imageText.dataset.imageTextIndex), "imageText", imageText.value);

          const imageDescription = event.target.closest("[data-image-description-index]");
          if (imageDescription) this.updateImageField(Number(imageDescription.dataset.imageDescriptionIndex), "visualDescription", imageDescription.value);
        });

        document.body.addEventListener("change", event => {
          const caseFilter = event.target.closest("[data-case-filter]");
          if (caseFilter) this.updateCaseFilter(caseFilter.dataset.caseFilter, caseFilter.value);
        });

        document.querySelector("#auditForm").addEventListener("submit", event => {
          event.preventDefault();
          this.submitAudit();
        });
        document.querySelector("#nextConfigBtn").addEventListener("click", () => this.goToConfig());
        document.querySelector("#adText").addEventListener("input", () => this.updateCharCount());
        document.querySelector("#imageInput").addEventListener("change", event => this.handleImages(event));
        document.querySelector("#clearBtn").addEventListener("click", () => this.clearForm());
      },
      async renderDeepSeekStatus() {
        const statuses = Array.from(document.querySelectorAll("[data-deepseek-status]"));
        if (!statuses.length) return;
        const applyStatus = (message, connected) => {
          statuses.forEach(status => {
            status.textContent = message;
            status.classList.toggle("connected", Boolean(connected));
            status.classList.toggle("offline", !connected);
          });
        };
        try {
          const health = await getHealth();
          const mode = health.runtimeMode || "本地开发模式";
          applyStatus(
            `运行模式：${mode} · ${health.connected ? "DeepSeek 已连接" : (health.message || "DeepSeek 未配置，当前使用本地演示模式")}`,
            Boolean(health.connected)
          );
        } catch (error) {
          applyStatus("DeepSeek 连接检测失败：当前为本地演示模式", false);
        }
      },
      renderSimulationCases() {
        const grid = document.querySelector("#simulationCaseGrid");
        if (!grid) return;
        grid.innerHTML = SimulationCases.map(item => `
          <article class="simulation-case ${this.appState.selectedSimulationCase === item.id ? "active" : ""}">
            <div>
              <span class="tag">${TextToolkit.escapeHtml(MarketingOptimizer.platformLabels[item.targetPlatform] || "通用")}</span>
              <h3>${TextToolkit.escapeHtml(item.title)}</h3>
              <p>${TextToolkit.escapeHtml(item.productName)} · ${TextToolkit.escapeHtml(item.priceRange)}</p>
            </div>
            <button class="secondary-btn" type="button" data-simulation-case="${TextToolkit.escapeHtml(item.id)}">使用该案例模拟</button>
          </article>
        `).join("");
      },
      enterSimulationMode() {
        this.appState.simulationMode = true;
        document.body.classList.add("simulation-mode");
        this.switchPage("workspace");
        this.switchStage("input");
        this.renderSimulationCases();
        this.updateSimulationStep("input");
        this.toast("已进入模拟演示模式");
      },
      exitSimulationMode() {
        this.appState.simulationMode = false;
        document.body.classList.remove("simulation-mode", "presentation-mode");
        this.switchPage("home");
        this.updateSimulationStep("");
        this.toast("已退出模拟演示");
      },
      updateSimulationStep(step) {
        const normalized = this.appState.finalVersion && step === "rewrite" ? "final" : step;
        document.querySelectorAll("[data-sim-step]").forEach(item => {
          item.classList.toggle("active", item.dataset.simStep === normalized);
          item.classList.toggle("done", this.simulationStepDone(item.dataset.simStep, normalized));
        });
      },
      simulationStepDone(step, current) {
        const order = ["input", "process", "report", "rewrite", "final", "export"];
        return order.indexOf(step) > -1 && order.indexOf(step) < order.indexOf(current);
      },
      switchPage(page) {
        document.querySelectorAll(".page").forEach(section => section.classList.toggle("active", section.id === page));
        document.querySelectorAll(".nav button").forEach(button => button.classList.toggle("active", button.dataset.page === page));
        this.appState.step = page;
        if (page === "workspace") this.switchStage(this.appState.result ? "report" : "input");
      },
      switchStage(stage) {
        const normalizedStage = stage === "process" ? "diagnosing" : stage;
        this.workflow.goToStep(normalizedStage);
        const domStage = normalizedStage === "diagnosing" ? "process" : normalizedStage;
        document.querySelectorAll(".stage").forEach(section => section.classList.toggle("active", section.id === `stage-${domStage}`));
        this.renderStepper();
        this.appState.step = normalizedStage;
        this.updateSimulationStep(domStage);
        if (normalizedStage === "report" || normalizedStage === "rewrite") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      },
      goToStep(step) {
        this.switchStage(step);
      },
      goNextStep() {
        this.switchStage(this.workflow.goNextStep());
      },
      goPrevStep() {
        this.switchStage(this.workflow.goPrevStep());
      },
      enterRewriteStudio() {
        if (!this.appState.result) {
          this.toast("请先完成诊断");
          return;
        }
        if (!this.appState.result.rewrites) {
          this.workflow.setRewriting(true);
          this.appState.result.rewrites = MarketingOptimizer.rewrite(this.appState.request, []);
          this.workflow.setRewriteResult(this.appState.result.rewrites);
          this.renderRewrite(this.appState.result);
        } else {
          this.workflow.setRewriteResult(this.appState.result.rewrites);
        }
        this.switchStage("rewrite");
      },
      async regenerateRewrite() {
        if (!this.appState.result) {
          this.toast("请先完成诊断");
          return;
        }
        this.workflow.setRewriting(true);
        try {
          const currentKey = this.appState.selectedRewriteKey || "platform";
          const reply = await AuditService.rewriteChat({
            auditResult: this.appState.result,
            currentCopy: this.getRewriteTextByKey(currentKey),
            userMessage: "请重新生成当前选中版本，保留营销张力并降低信任阻碍。",
            history: this.appState.chatHistory.map(item => ({ role: item.role, content: item.content }))
          });
          if (reply.newCopy || reply.newRewrite) {
            this.setRewriteTextByKey(currentKey, reply.newCopy || reply.newRewrite);
            this.appState.result.rewrites.rewriteDiff = [...(this.appState.result.rewrites.rewriteDiff || []), ...(reply.changeNotes || [])];
            this.workflow.setRewriteResult(this.appState.result.rewrites);
            this.renderRewrite(this.appState.result);
            this.toast("已重新生成当前版本");
          }
        } catch (error) {
          this.workflow.setError(error);
          this.toast("重新生成失败，请稍后重试");
        } finally {
          this.workflow.setRewriting(false);
        }
      },
      renderStepper() {
        const order = this.workflow.state.steps;
        const currentIndex = order.indexOf(this.workflow.state.currentStep);
        document.querySelectorAll(".stepper button").forEach(button => {
          const buttonStep = button.dataset.stage === "process" ? "diagnosing" : button.dataset.stage;
          const index = order.indexOf(buttonStep);
          const isActive = buttonStep === this.workflow.state.currentStep;
          const isDone = index >= 0 && index < currentIndex;
          button.classList.toggle("active", isActive);
          button.classList.toggle("done", isDone);
          button.classList.toggle("locked", index > currentIndex && !this.workflow.state.auditResult);
          const icon = button.querySelector("em");
          if (icon) icon.textContent = isDone ? "✓" : String(index + 1);
        });
      },
      goToConfig() {
        const text = document.querySelector("#adText").value.trim();
        if (!text) {
          this.toast("请先输入广告文本");
          return;
        }
        this.switchStage("config");
      },
      updateCharCount() {
        const text = document.querySelector("#adText").value;
        document.querySelector("#charCount").textContent = `${text.length} / 5000`;
      },
      handleImages(event) {
        const files = Array.from(event.target.files || []);
        const allowed = files.filter(file => /^image\/(jpeg|png|webp)$/.test(file.type));
        if (allowed.length !== files.length) this.toast("仅支持 jpg、png、webp 图片");

        const remain = Math.max(0, 5 - (this.appState.request.images || []).length);
        const selected = allowed.slice(0, remain);
        if (allowed.length > remain) this.toast("最多上传 5 张图片");
        if (!selected.length) return;

        const readers = selected.map(file => new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve({
            id: `img-${Date.now()}-${Math.random().toString(16).slice(2)}`,
            name: file.name,
            type: file.type,
            imageType: document.querySelector("#imageType").value,
            dataUrl: reader.result,
            imageText: "",
            visualDescription: "",
            marketingObservations: [],
            confidence: 0,
            provider: "manual",
            status: "识别中"
          });
          reader.readAsDataURL(file);
        }));

        Promise.all(readers).then(images => {
          this.appState.request.images = [...(this.appState.request.images || []), ...images].slice(0, 5);
          this.renderImagePreviews();
          images.forEach(image => this.extractUploadedImage(image.id));
          event.target.value = "";
        });
      },
      async extractUploadedImage(imageId) {
        const image = (this.appState.request.images || []).find(item => item.id === imageId);
        if (!image) return;

        try {
          const result = await AuditService.extractImage(image);
          Object.assign(image, {
            imageText: result.imageText || image.imageText || "",
            visualDescription: result.visualDescription || "",
            marketingObservations: result.marketingObservations || [],
            confidence: result.confidence || 0,
            provider: result.provider || "manual",
            status: result.provider === "ocr"
              ? "OCR识别完成"
              : result.ocrError
                ? "OCR失败，可手动补充"
                : result.imageText
                  ? "已手动补充"
                  : "待手动补充"
          });
          this.syncImageTextField();
          this.renderImagePreviews();
          this.toast(image.provider === "ocr" ? "本地 OCR 识别完成，可继续手动修正" : "图片已预览，请手动补充图片文字");
        } catch (error) {
          Object.assign(image, {
            visualDescription: "图片识别暂不可用，请手动输入图片中的文字。",
            marketingObservations: ["请手动补充主标题、价格权益和行动按钮信息。"],
            provider: "manual",
            status: "识别失败，可手动补充"
          });
          this.renderImagePreviews();
          this.toast("图片识别暂不可用，可手动补充图片文字");
        }
      },
      renderImagePreviews() {
        const images = this.appState.request.images || [];
        document.querySelector("#imagePreviewGrid").innerHTML = images.map((image, index) => `
          <article class="image-preview ${image.status === "识别中" ? "loading" : ""}">
            <button class="image-remove" type="button" data-remove-image="${index}" title="删除图片">×</button>
            <img src="${image.dataUrl}" alt="上传图片预览" />
            <div class="image-preview-meta">
              <strong>${TextToolkit.escapeHtml(image.name)}</strong>
              <span>${TextToolkit.escapeHtml(image.status || "待识别")} · ${TextToolkit.escapeHtml(image.provider || "manual")}</span>
            </div>
            <label>图片文字
              <textarea data-image-text-index="${index}" maxlength="1200" placeholder="请输入图片中的主标题、卖点、价格、权益和CTA">${TextToolkit.escapeHtml(image.imageText || "")}</textarea>
            </label>
            <label>视觉描述
              <textarea data-image-description-index="${index}" maxlength="800" placeholder="例如：主标题在顶部，价格在右下角，按钮为立即领取">${TextToolkit.escapeHtml(image.visualDescription || "")}</textarea>
            </label>
            <ul class="image-observations">
              ${(image.marketingObservations || []).slice(0, 4).map(item => `<li>${TextToolkit.escapeHtml(item)}</li>`).join("")}
            </ul>
          </article>
        `).join("");
        this.syncImageTextField();
      },
      removeImage(index) {
        this.appState.request.images = (this.appState.request.images || []).filter((_, currentIndex) => currentIndex !== index);
        this.renderImagePreviews();
      },
      updateImageField(index, field, value) {
        const image = (this.appState.request.images || [])[index];
        if (!image) return;
        image[field] = value;
        image.status = image.imageText ? "已手动补充" : image.status;
        this.syncImageTextField();
      },
      syncImageTextField() {
        const textarea = document.querySelector("#imageText");
        if (!textarea) return;
        const images = this.appState.request.images || [];
        if (!images.length) return;
        const hasImageContent = images.some(image => image.imageText || image.visualDescription);
        if (!hasImageContent && textarea.value.trim()) return;
        textarea.value = images
          .map((image, index) => {
            const parts = [
              `图片${index + 1}：${image.name}`,
              image.imageText ? `文字：${image.imageText}` : "",
              image.visualDescription ? `视觉：${image.visualDescription}` : ""
            ].filter(Boolean);
            return parts.join("\n");
          })
          .filter(Boolean)
          .join("\n\n");
      },
      chooseOption(button) {
        const group = button.closest("[data-choice-group]");
        const fieldId = group.dataset.choiceGroup;
        group.querySelectorAll(".option-card").forEach(item => item.classList.toggle("active", item === button));
        document.querySelector(`#${fieldId}`).value = button.dataset.value;
        this.appState.request[fieldId] = button.dataset.value;
      },
      setChoice(fieldId, value) {
        const field = document.querySelector(`#${fieldId}`);
        field.value = value;
        const group = document.querySelector(`[data-choice-group="${fieldId}"]`);
        if (!group) return;
        group.querySelectorAll(".option-card").forEach(item => item.classList.toggle("active", item.dataset.value === value));
      },
      readRequest() {
        return {
          text: document.querySelector("#adText").value.trim(),
          productName: document.querySelector("#productName").value.trim(),
          productCategory: document.querySelector("#productCategory").value,
          priceRange: document.querySelector("#priceRange").value.trim(),
          sellingPoints: document.querySelector("#sellingPoints").value.trim(),
          proofMaterials: document.querySelector("#proofMaterials").value.trim(),
          adGoal: document.querySelector("#adGoal").value,
          imageType: document.querySelector("#imageType").value,
          imageText: document.querySelector("#imageText").value.trim(),
          images: this.appState.request.images || [],
          targetPlatform: document.querySelector("#targetPlatform").value,
          targetAudience: document.querySelector("#targetAudience").value,
          marketingStyle: document.querySelector("#marketingStyle").value,
          complianceStrength: document.querySelector("#complianceStrength").value,
          contentType: document.querySelector("#contentType").value,
          industry: document.querySelector("#industry").value,
          mode: document.querySelector("#mode").value,
          tone: document.querySelector("#tone").value
        };
      },
      submitAudit() {
        const request = this.readRequest();
        if (!request.text) {
          this.toast("请输入广告文本");
          return;
        }
        if (request.text.length > 5000) {
          this.toast("文本不能超过5000字");
          return;
        }
        const submitBtn = document.querySelector("#submitBtn");
        if (submitBtn) submitBtn.disabled = true;
        this.workflow.setAuditRequest(request);
        this.workflow.setDiagnosing(true);
        this.appState.request = request;
        this.switchStage("diagnosing");
        this.animateProcess(async () => {
          try {
            this.appState.result = await AuditService.audit(request);
            this.workflow.setAuditResult(this.appState.result);
            this.appState.chatHistory = [];
            this.appState.selectedRewriteKey = "platform";
            this.appState.finalVersion = this.appState.result.finalVersion || null;
            this.saveHistory(this.appState.result);
            this.renderReport(this.appState.result);
            this.renderRewrite(this.appState.result);
            if (submitBtn) submitBtn.disabled = false;
            this.switchStage("report");
            this.updateSimulationStep("report");
            this.toast(this.appState.result.notice || "诊断完成，已生成营销诊断报告");
          } catch (error) {
            this.workflow.setError(error);
            if (submitBtn) submitBtn.disabled = false;
            this.renderProcess("failed", this.processStep);
            this.toast("诊断失败，请返回修改素材后重试");
          }
        });
      },
      animateProcess(done) {
        const total = 6;
        this.processStep = 0;
        window.setTimeout(() => {
          this.renderProcess("running", this.processStep);
        }, 0);
        const timer = window.setInterval(() => {
          this.processStep += 1;
          this.renderProcess(this.processStep >= total ? "done" : "running", this.processStep);
          if (this.processStep >= total) {
            window.clearInterval(timer);
            window.setTimeout(done, 250);
          }
        }, 420);
      },
      renderProcess(state, completedCount = 0) {
        const steps = [
          ["读取产品与素材", "整理产品名称、卖点、证明材料、文案和目标平台。"],
          ["提取图片文字", "读取上传图片的文字或使用手动输入内容。"],
          ["推断消费者画像", "判断目标人群、购买动机和主要顾虑。"],
          ["匹配优秀案例与规则库", "检索案例库、法律规则库和平台规则库。"],
          ["计算信任转化评分", "生成消费者信任度、转化吸引力、圈层匹配等指标。"],
          ["生成改写建议", "输出多风格文案、差异说明和展示报告。"]
        ];
        document.querySelector("#processGrid").innerHTML = steps.map((step, index) => {
          const isDone = state === "done" || index < completedCount;
          const isRunning = state === "running" && index === completedCount;
          const isFailed = state === "failed" && index === Math.min(completedCount, steps.length - 1);
          const className = isFailed ? "failed" : isDone ? "done" : isRunning ? "running" : "";
          const icon = isFailed ? "!" : isDone ? "✓" : index + 1;
          return `<article class="process-card ${className}"><span class="process-status">${icon}</span><strong>${step[0]}</strong><p>${step[1]}</p></article>`;
        }).join("") + (state === "failed" ? `
          <div class="notice">
            诊断失败：${TextToolkit.escapeHtml(this.workflow.state.error || "接口暂不可用")}。
            <button class="secondary-btn" type="button" data-stage="input">返回修改素材</button>
          </div>
        ` : "");
      },
      renderReport(result) {
        const reportBody = document.querySelector("#reportBody");
        const metrics = result.metrics || {};
        const isSimulation = this.appState.simulationMode;
        reportBody.innerHTML = `
          <div class="sticky-action-bar">
            <button class="secondary-btn" type="button" data-stage="input">返回修改素材</button>
            <button class="primary-btn big-action" type="button" data-enter-rewrite>进入改写工作室</button>
            ${isSimulation ? `<button class="secondary-btn" data-download="report">导出模拟报告</button>` : `
              <button class="secondary-btn" type="button" data-rediagnose>重新诊断</button>
              <button class="secondary-btn" data-copy="report">复制报告</button>
            `}
          </div>
          <div class="summary-band featured">
            <div>
              <span class="section-label">营销优化结论</span>
              <h1 class="summary-title">${TextToolkit.escapeHtml(result.summary.marketingConclusion)}</h1>
              <p class="summary-sentence">${TextToolkit.escapeHtml(this.summarySentence(result))}</p>
              <div class="tag-row">${result.frictionItems.map(item => `<span class="tag warn">${TextToolkit.escapeHtml(item.name)}</span>`).join("")}</div>
              <div class="summary-metrics">
                <div class="metric-pill"><span>目标人群</span><strong>${TextToolkit.escapeHtml(result.consumerProfile.inferredAudience)}</strong></div>
                <div class="metric-pill"><span>平台</span><strong>${TextToolkit.escapeHtml(MarketingOptimizer.platformLabels[result.request.targetPlatform] || "通用")}</strong></div>
                <div class="metric-pill"><span>信任阻碍</span><strong>${result.frictionItems.length}</strong></div>
              </div>
            </div>
            <div class="score-pair">
              ${this.gauge("消费者信任度", metrics.trustScore, this.metricLevel(metrics.trustScore), "var(--trust-cyan)")}
              ${this.gauge("转化吸引力", metrics.conversionAppeal, this.metricLevel(metrics.conversionAppeal), "var(--conversion-gold)")}
            </div>
          </div>
          <section class="card">
            <h2>五项核心指标</h2>
            <div class="dimension-list">
              ${this.renderMetricBars(metrics)}
            </div>
          </section>
          <div class="report-grid">
            <div class="report-main">
              <section class="card">
                <h2>消费者画像</h2>
                <div class="meta-grid">
                  ${this.meta("推断目标人群", result.consumerProfile.inferredAudience)}
                  ${this.meta("消费动机", result.consumerProfile.motivation)}
                  ${this.meta("价格敏感度", result.consumerProfile.priceSensitivity)}
                  ${this.meta("购买触发点", result.consumerProfile.purchaseTrigger)}
                </div>
              </section>
              <section class="card">
                <h2>圈层偏好分析</h2>
                <div class="meta-grid">
                  ${this.meta("喜欢的表达", result.circlePreference.likes)}
                  ${this.meta("反感的表达", result.circlePreference.dislikes)}
                  ${this.meta("匹配程度", result.circlePreference.matchLevel)}
                  ${this.meta("推荐关键词", result.circlePreference.recommendedKeywords)}
                </div>
              </section>
              <section class="card">
                <h2>图片广告分析</h2>
                ${this.renderImageAnalysis(result.imageAnalysis)}
              </section>
              <section class="card">
                <h2>信任阻碍点</h2>
                <div class="top-risk-grid">${this.renderFrictionCards(result.frictionItems)}</div>
              </section>
              <section class="card">
                <h2>转化损耗点</h2>
                <div class="tag-row">${result.conversionLosses.map(item => `<span class="tag warn">${TextToolkit.escapeHtml(item)}</span>`).join("")}</div>
              </section>
              <section class="card">
                <h2>合规底线提醒</h2>
                <div class="risk-list">${result.complianceReminders.map(item => `<article class="risk-item low"><p class="reason">${TextToolkit.escapeHtml(item)}</p></article>`).join("")}</div>
              </section>
              <section class="card">
                <h2>参考案例</h2>
                <p class="subcopy">案例库为模拟案例，用于分析文案结构与转化机制，不代表真实品牌投放素材。</p>
                <div class="risk-list">${(result.caseReferences || []).map(item => `
                  <article class="risk-item low">
                    <p class="sentence">${TextToolkit.escapeHtml(item.title || item.industry || "参考案例")} · ${TextToolkit.escapeHtml(item.platform || "")}</p>
                    <p class="reason">为什么有效：${TextToolkit.escapeHtml((item.whyItWorks || []).join("；") || item.copy || item.originalExample || "")}</p>
                    <p class="reason">可复用结构：${TextToolkit.escapeHtml((item.usablePatterns || []).join("；") || "按场景、卖点、证据、行动入口组织。")}</p>
                  </article>
                `).join("") || `<p class="subcopy">暂无匹配案例。</p>`}</div>
              </section>
              <section class="card">
                <h2>参考规则摘要</h2>
                <div class="risk-list">${(result.legalReferences || []).map(item => `
                  <article class="risk-item low">
                    <p class="sentence">${TextToolkit.escapeHtml(item.topic || "规则摘要")}</p>
                    <p class="reason">${TextToolkit.escapeHtml(item.summary || "")}</p>
                    <p class="reason">高风险表达：${TextToolkit.escapeHtml((item.highRiskPatterns || item.forbiddenPatterns || []).join("、") || "暂无")}</p>
                    <p class="reason">更稳妥替代：${TextToolkit.escapeHtml((item.saferAlternatives || item.allowedAlternatives || []).join("、") || "补充真实依据和适用条件")}</p>
                    <p class="reason">营销建议：${TextToolkit.escapeHtml(item.marketingAdvice || "在保留卖点的同时说明适用边界。")}</p>
                    <p class="reason">${TextToolkit.escapeHtml(item.note || "仅作风险提示，不构成法律意见")}</p>
                  </article>
                `).join("") || `<p class="subcopy">暂无匹配规则摘要。</p>`}</div>
              </section>
              <section class="card">
                <h2>平台适配建议</h2>
                <div class="risk-list">${(result.platformReferences || result.platformAdaptation || []).map(item => `
                  <article class="risk-item low">
                    <p class="sentence">${TextToolkit.escapeHtml(item.platform || "目标平台")}</p>
                    <p class="reason">内容风格：${TextToolkit.escapeHtml(item.contentStyle || "按平台语境组织表达。")}</p>
                    <p class="reason">推荐结构：${TextToolkit.escapeHtml((item.preferredStructure || []).join(" → ") || "场景 → 卖点 → 证据 → CTA")}</p>
                    <p class="reason">避免表达：${TextToolkit.escapeHtml((item.avoidPatterns || []).join("、") || "避免无依据承诺和虚假稀缺")}</p>
                  </article>
                `).join("") || `<p class="subcopy">暂无匹配平台建议。</p>`}</div>
              </section>
            </div>
            <aside class="report-side">
              <section class="card">
                <h2>素材与目标</h2>
                <div class="meta-grid">
                  ${this.meta("产品名称", result.request.productName || "未填写")}
                  ${this.meta("产品品类", FieldLabels.industry[result.request.productCategory] || "其他")}
                  ${this.meta("广告目标", this.goalLabel(result.request.adGoal))}
                  ${this.meta("合规强度", this.complianceLabel(result.request.complianceStrength))}
                </div>
              </section>
              <section class="card">
                <h2>信任与合规底线清单</h2>
                <ul class="checklist">${this.renderMarketingChecklist(result)}</ul>
              </section>
            </aside>
          </div>
          <section class="card">
            <h2>展示报告</h2>
            <div class="markdown-box">${TextToolkit.escapeHtml(result.markdownReport)}</div>
          </section>
          <div class="export-bar">
            <button class="secondary-btn" type="button" id="presentationBtn">模拟演示模式</button>
            <button class="secondary-btn" data-copy="highTrust">复制高信任版</button>
            <button class="secondary-btn" data-copy="highConversion">复制高转化版</button>
            <button class="secondary-btn" data-copy="report">复制完整报告</button>
            <button class="primary-btn" data-download="report">下载报告</button>
          </div>
        `;
      },
      renderRewrite(result) {
        const rewrites = result.rewrites || {};
        const tabs = this.getRewriteTabs(result);
        const selectedKey = this.appState.selectedRewriteKey || "platform";
        const selected = tabs.find(tab => tab.key === selectedKey) || tabs[0];
        const finalVersion = this.appState.finalVersion || result.finalVersion;
        const isSimulation = this.appState.simulationMode;
        document.querySelector("#rewriteBody").innerHTML = `
          <div class="sticky-action-bar">
            <button class="secondary-btn" type="button" data-stage="report">返回诊断报告</button>
            <button class="secondary-btn" data-copy="current">复制当前版本</button>
            <button class="secondary-btn" data-set-final="${selected.key}">设为最终版本</button>
            <button class="primary-btn big-action" data-generate-final>生成最终投放版</button>
            ${isSimulation ? `<button class="secondary-btn" data-download="report">导出模拟报告</button>` : `<button class="primary-btn" type="button" data-regenerate>重新生成</button>`}
          </div>
          <div class="rewrite-studio-layout">
            <aside class="rewrite-summary-panel">
              <section class="card">
                <span class="section-label">诊断摘要</span>
                <h2>${TextToolkit.escapeHtml(result.request.productName || result.consumerProfile.category || "当前广告")}</h2>
                <div class="meta-grid compact">
                  ${this.meta("目标消费者", result.consumerProfile.inferredAudience)}
                  ${this.meta("平台", MarketingOptimizer.platformLabels[result.request.targetPlatform] || result.basicInfo?.platform || "通用")}
                  ${this.meta("主要顾虑", result.consumerProfile.mainConcerns)}
                </div>
              </section>
              <section class="card">
                <h2>当前五项评分</h2>
                <div class="dimension-list compact-bars">${this.renderMetricBars(result.metrics || {})}</div>
              </section>
              <section class="card">
                <h2>主要信任阻碍</h2>
                <div class="tag-row">${(result.frictionItems || []).slice(0, 5).map(item => `<span class="tag warn">${TextToolkit.escapeHtml(item.name || item)}</span>`).join("") || `<span class="tag">暂无明显阻碍</span>`}</div>
              </section>
              <section class="card">
                <h2>主要转化损耗点</h2>
                <div class="risk-list">${(result.conversionLosses || []).slice(0, 4).map(item => `<article class="risk-item low"><p class="reason">${TextToolkit.escapeHtml(item)}</p></article>`).join("") || `<p class="subcopy">暂无明显转化损耗点。</p>`}</div>
              </section>
            </aside>
            <section class="rewrite-workspace-panel">
              <div class="rewrite-tabs" role="tablist">
                ${tabs.map(tab => `<button class="${tab.key === selected.key ? "active" : ""}" type="button" data-rewrite-tab="${tab.key}">${tab.title}</button>`).join("")}
              </div>
              <article class="card rewrite-active-card">
                <div class="rewrite-active-head">
                  <div>
                    <span class="section-label">${TextToolkit.escapeHtml(selected.title)}</span>
                    <h2>${TextToolkit.escapeHtml(selected.subtitle)}</h2>
                    <p class="subcopy">${TextToolkit.escapeHtml(selected.note)}</p>
                  </div>
                  <div class="rewrite-actions">
                    <button class="secondary-btn" data-copy="current">复制当前版本</button>
                    <button class="primary-btn" data-set-final="${selected.key}">设为最终版本</button>
                  </div>
                </div>
                <div class="rewrite-text large">${TextToolkit.escapeHtml(selected.text)}</div>
                <div class="tag-row">${(selected.meta || []).map((item, index) => `<span class="tag">${["适用平台", "适合人群", "保留张力", "降低阻碍", "转化逻辑"][index] || "说明"}：${TextToolkit.escapeHtml(item)}</span>`).join("")}</div>
              </article>
              <section class="card">
                <h2>改写差异说明</h2>
                <div class="tag-row">${(rewrites.rewriteDiff || []).map(item => `<span class="tag">${TextToolkit.escapeHtml(item)}</span>`).join("")}</div>
              </section>
              <section class="card chat-panel">
                <h2>对话追问</h2>
                <p class="subcopy">点击快捷问题会直接调用后端生成新文案，也可以输入自定义追问连续微调。</p>
                <div class="quick-grid">
                  ${this.chatStarters(result).map(item => `<button class="secondary-btn" type="button" data-chat-starter="${TextToolkit.escapeHtml(item)}">${TextToolkit.escapeHtml(item)}</button>`).join("")}
                </div>
                <div class="chat-log" id="rewriteChatLog">${this.renderChatLog()}</div>
                <label>追问内容<textarea id="rewriteChatInput" maxlength="1000" placeholder="例如：帮我改得更像小红书，但不要太假"></textarea></label>
                <div class="form-actions">
                  <button class="primary-btn" type="button" id="rewriteChatSend">发送追问</button>
                  <button class="secondary-btn" type="button" data-generate-final>生成最终投放版</button>
                </div>
              </section>
              <section class="card final-copy-card">
                <div class="rewrite-active-head">
                  <div>
                    <span class="section-label">最终文案区</span>
                    <h2>${TextToolkit.escapeHtml(finalVersion?.finalTitle || "尚未设置最终版本")}</h2>
                    <p class="subcopy">${finalVersion ? `推荐平台：${TextToolkit.escapeHtml(finalVersion.recommendedPlatform || "通用")} · CTA：${TextToolkit.escapeHtml(finalVersion.cta || "按需咨询")}` : "可从任一版本设为最终版本，或点击生成最终投放版。"}</p>
                  </div>
                  <div class="rewrite-actions">
                    <button class="secondary-btn" data-copy="final">复制最终文案</button>
                    <button class="primary-btn" data-download="${isSimulation ? "report" : "final"}">${isSimulation ? "导出模拟报告" : "导出最终文案"}</button>
                  </div>
                </div>
                <div class="rewrite-text large">${TextToolkit.escapeHtml(finalVersion?.finalCopy || selected.text)}</div>
                <div class="tag-row">${(finalVersion?.whyThisWorks || []).map(item => `<span class="tag">${TextToolkit.escapeHtml(item)}</span>`).join("")}</div>
                <div class="tag-row">${(finalVersion?.abTestSuggestion || []).map(item => `<span class="tag warn">${TextToolkit.escapeHtml(item)}</span>`).join("")}</div>
              </section>
            </div>
        `;
      },
      getRewriteTabs(result) {
        const rewrites = result.rewrites || {};
        const meta = rewrites.versionMeta || {};
        return [
          { key: "highTrust", title: "高信任版", subtitle: "适合品牌官方、详情页、项目展示", note: "强化真实感、证据感和透明度。", text: rewrites.highTrustVersion || "", meta: meta.highTrustVersion || [] },
          { key: "highConversion", title: "高转化版", subtitle: "适合促销、私域、直播间", note: "保留真实、具体、可解释的紧迫感。", text: rewrites.highConversionVersion || "", meta: meta.highConversionVersion || [] },
          { key: "seeding", title: "种草真实版", subtitle: "适合小红书、短视频口播", note: "更口语，更像真实体验。", text: rewrites.seedingRealVersion || "", meta: meta.seedingRealVersion || [] },
          { key: "gentleUrgency", title: "温和紧迫版", subtitle: "保留行动推动力但不虚假夸张", note: "保留限时、权益、错过成本等元素。", text: rewrites.gentleUrgencyVersion || "", meta: meta.gentleUrgencyVersion || [] },
          { key: "platform", title: "平台适配版", subtitle: "按目标平台生成对应版本", note: "适配小红书、抖音、私域、电商或海报语境。", text: rewrites.platformVersion || "", meta: meta.platformVersion || [] }
        ];
      },
      chatStarters(result) {
        return Array.from(new Set([
          ...(result.chatStarters || []),
          "帮我改得更像小红书",
          "帮我改得更适合直播间",
          "保留饥饿营销，但不要显得虚假",
          "写得更短更有记忆点",
          "强化学生党购买理由",
          "强化成分党信任感",
          "改得更高级，不要像硬广",
          "帮我生成3个标题",
          "帮我生成海报主标题",
          "帮我生成最终投放版"
        ])).slice(0, 10);
      },
      renderChatLog() {
        if (!this.appState.chatHistory.length) return `<p class="subcopy">暂无追问记录。</p>`;
        return this.appState.chatHistory.map(item => `
          <div class="chat-message ${item.role}">
            <strong>${item.role === "user" ? "你" : "AdTrust AI"}</strong>
            <span>${TextToolkit.escapeHtml(item.content)}</span>
          </div>
        `).join("");
      },
      applyChatStarter(message, autoSend = false) {
        const input = document.querySelector("#rewriteChatInput");
        if (input) input.value = message;
        if (autoSend) this.sendRewriteChat();
      },
      async sendRewriteChat() {
        const input = document.querySelector("#rewriteChatInput");
        const log = document.querySelector("#rewriteChatLog");
        const userMessage = input?.value.trim();
        if (!userMessage) {
          this.toast("请先输入追问内容");
          return;
        }
        this.appState.chatHistory.push({ role: "user", content: userMessage });
        if (log) log.innerHTML = this.renderChatLog();
        input.value = "";
        try {
          const reply = await AuditService.rewriteChat({
            auditResult: this.appState.result,
            currentCopy: this.getRewriteTextByKey(this.appState.selectedRewriteKey || "platform"),
            userMessage,
            history: this.appState.chatHistory.map(item => ({ role: item.role, content: item.content }))
          });
          const newCopy = reply.newCopy || reply.newRewrite || "";
          const content = `${reply.reply || "已生成新文案"}${reply.notice ? `\n\n提示：${reply.notice}` : ""}\n\n${newCopy}\n\n${(reply.changeNotes || []).map(item => `- ${item}`).join("\n")}`;
          this.appState.chatHistory.push({ role: "assistant", content });
          if (newCopy) {
            this.setRewriteTextByKey(this.appState.selectedRewriteKey || "platform", newCopy);
            this.appState.result.rewrites.rewriteDiff = [...(this.appState.result.rewrites.rewriteDiff || []), ...(reply.changeNotes || [])];
            if (reply.finalVersion) {
              this.appState.finalVersion = reply.finalVersion;
              this.appState.result.finalVersion = reply.finalVersion;
            }
            this.renderRewrite(this.appState.result);
          } else if (log) {
            log.innerHTML = this.renderChatLog();
          }
          this.toast(reply.provider === "fallback" ? "已使用本地兜底生成改写" : "已生成追问改写");
        } catch (error) {
          this.appState.chatHistory.push({ role: "assistant", content: "继续追问暂不可用，请稍后再试。" });
          if (log) log.innerHTML = this.renderChatLog();
        }
      },
      selectRewriteTab(key) {
        this.appState.selectedRewriteKey = key;
        this.renderRewrite(this.appState.result);
      },
      getRewriteTextByKey(key) {
        const rewrites = this.appState.result?.rewrites || {};
        return {
          highTrust: rewrites.highTrustVersion,
          highConversion: rewrites.highConversionVersion,
          seeding: rewrites.seedingRealVersion,
          gentleUrgency: rewrites.gentleUrgencyVersion,
          platform: rewrites.platformVersion
        }[key] || rewrites.platformVersion || "";
      },
      setRewriteTextByKey(key, value) {
        const rewrites = this.appState.result.rewrites;
        const map = {
          highTrust: "highTrustVersion",
          highConversion: "highConversionVersion",
          seeding: "seedingRealVersion",
          gentleUrgency: "gentleUrgencyVersion",
          platform: "platformVersion"
        };
        rewrites[map[key] || "platformVersion"] = value;
      },
      setFinalVersion(key) {
        const tabs = this.getRewriteTabs(this.appState.result);
        const selected = tabs.find(tab => tab.key === key) || tabs.find(tab => tab.key === "platform") || tabs[0];
        const finalVersion = {
          finalTitle: selected.text.split("\n").find(Boolean)?.replace(/[【】]/g, "") || selected.title,
          finalCopy: selected.text,
          cta: this.inferCta(selected.text),
          whyThisWorks: [
            `来源版本：${selected.title}`,
            "保留核心卖点和明确行动入口。",
            "降低无依据承诺和虚假稀缺表达。"
          ],
          recommendedPlatform: MarketingOptimizer.platformLabels[this.appState.result.request.targetPlatform] || "通用",
          abTestSuggestion: [
            "A版突出信任依据，测试收藏和咨询。",
            "B版突出权益和CTA，测试点击和转化。"
          ]
        };
        this.appState.finalVersion = finalVersion;
        this.appState.result.finalVersion = finalVersion;
        this.renderRewrite(this.appState.result);
        this.updateSimulationStep("final");
        this.toast("已设为最终版本");
      },
      async generateFinalVersion() {
        if (!this.appState.result) return;
        const message = "帮我生成最终投放版";
        this.appState.chatHistory.push({ role: "user", content: message });
        this.renderRewrite(this.appState.result);
        try {
          const reply = await AuditService.rewriteChat({
            auditResult: this.appState.result,
            currentCopy: this.getRewriteTextByKey(this.appState.selectedRewriteKey || "platform"),
            userMessage: message,
            history: this.appState.chatHistory.map(item => ({ role: item.role, content: item.content }))
          });
          const newCopy = reply.newCopy || reply.newRewrite || "";
          if (newCopy) this.setRewriteTextByKey(this.appState.selectedRewriteKey || "platform", newCopy);
          if (reply.finalVersion) {
            this.appState.finalVersion = reply.finalVersion;
            this.appState.result.finalVersion = reply.finalVersion;
          } else if (newCopy) {
            this.setFinalVersion(this.appState.selectedRewriteKey || "platform");
          }
          this.appState.chatHistory.push({
            role: "assistant",
            content: `${reply.reply || "已生成最终投放版"}\n\n${reply.finalVersion?.finalCopy || newCopy}`
          });
          this.renderRewrite(this.appState.result);
          this.updateSimulationStep("final");
          this.toast("已生成最终投放版");
        } catch (error) {
          this.appState.chatHistory.push({ role: "assistant", content: "最终投放版生成失败，请稍后重试。" });
          this.renderRewrite(this.appState.result);
        }
      },
      inferCta(text) {
        const match = String(text || "").match(/(私信[^。！\n]*|查看详情页[^。！\n]*|扫码[^。！\n]*|咨询[^。！\n]*|领取[^。！\n]*|下单[^。！\n]*)/);
        return match?.[0] || "先咨询或查看详情";
      },
      gauge(label, score, level, color) {
        return `<div class="gauge" style="--value:${score};--gauge-color:${color}"><div class="gauge-ring"><strong>${score}</strong></div><span>${label}<br>${level}</span></div>`;
      },
      metricLevel(score) {
        if (score >= 85) return "优秀";
        if (score >= 70) return "较好";
        if (score >= 55) return "待优化";
        return "需重点优化";
      },
      summarySentence(result) {
        const profile = result.consumerProfile;
        const firstLoss = result.conversionLosses[0] || "建议进一步强化证据、场景和行动入口。";
        return `目标人群更可能关注“${profile.mainConcerns}”，当前优先优化方向是：${firstLoss}`;
      },
      meta(label, value) {
        return `<div class="meta"><span>${label}</span><strong>${TextToolkit.escapeHtml(value)}</strong></div>`;
      },
      renderImageAnalysis(imageAnalysis = {}) {
        const texts = imageAnalysis.imageTexts || [];
        const observations = imageAnalysis.marketingObservations || [];
        return `
          <div class="image-analysis-grid">
            ${this.meta("图片文字提取", texts.join("；") || "未提供图片文字，可在素材输入页手动补充")}
            ${this.meta("视觉层级判断", imageAnalysis.hierarchyJudgement || "未上传图片素材")}
            ${this.meta("主标题清晰度", imageAnalysis.headlineClarity || "待判断")}
            ${this.meta("卖点突出度", imageAnalysis.sellingPointVisibility || "待判断")}
            ${this.meta("CTA 明确度", imageAnalysis.ctaClarity || "待判断")}
            ${this.meta("视觉信任感", imageAnalysis.visualTrust || "待判断")}
            ${this.meta("图片与文案一致性", imageAnalysis.textConsistency || "待判断")}
          </div>
          <div class="tag-row image-observation-tags">
            ${observations.map(item => `<span class="tag">${TextToolkit.escapeHtml(item)}</span>`).join("") || `<span class="tag">上传图片后会生成营销结构观察</span>`}
          </div>
        `;
      },
      renderMetricBars(metrics) {
        const items = [
          ["消费者信任度", metrics.trustScore, "衡量广告是否真实、可信、有证据、有透明度。", "var(--trust-cyan)"],
          ["转化吸引力", metrics.conversionAppeal, "衡量文案是否具备购买动机、行动召唤和情绪推动。", "var(--conversion-gold)"],
          ["圈层匹配度", metrics.audienceFit, "衡量语言是否贴近目标消费者的偏好和平台语境。", "var(--indigo)"],
          ["卖点清晰度", metrics.sellingPointClarity, "衡量用户能否快速理解产品价值和选择理由。", "var(--trust-cyan)"],
          ["合规安全度", metrics.complianceSafety, "衡量是否存在明显法律或平台表达底线问题。", "var(--risk-rose)"]
        ];
        return items.map(([label, value, explain, color]) => `
          <div class="dimension">
            <div class="dimension-head"><span>${label}</span><span>${value}/100 · ${this.metricLevel(value)}</span></div>
            <div class="bar-track"><div class="bar" style="width:${value}%;--bar-color:${color}"></div></div>
            <p class="reason">${explain}</p>
          </div>
        `).join("");
      },
      renderFrictionCards(items) {
        return items.map(item => `
          <article class="top-risk-card ${item.complianceBaseline === "是" ? "high" : "medium"}">
            <h3>${TextToolkit.escapeHtml(item.name)}</h3>
            <span class="status-label ${item.complianceBaseline === "是" ? "bad" : "mid"}">信任阻碍</span>
            <p class="reason"><strong>对信任的影响：</strong>${TextToolkit.escapeHtml(item.trustImpact)}</p>
            <p class="reason"><strong>对转化的影响：</strong>${TextToolkit.escapeHtml(item.conversionImpact)}</p>
            <p class="reason"><strong>是否涉及合规底线：</strong>${TextToolkit.escapeHtml(item.complianceBaseline)}</p>
            <p class="reason"><strong>优化建议：</strong>${TextToolkit.escapeHtml(item.suggestion)}</p>
          </article>
        `).join("");
      },
      renderMarketingChecklist(result) {
        const checks = [
          ["产品卖点是否清晰", result.metrics.sellingPointClarity >= 70, "卖点越具体，用户越容易快速理解价值。"],
          ["证明材料是否充分", !!result.request.proofMaterials.trim(), "补充检测、评价、销量或活动规则可提升信任度。"],
          ["行动召唤是否明确", result.metrics.conversionAppeal >= 70, "明确下一步动作有助于降低转化流失。"],
          ["圈层语言是否匹配", result.metrics.audienceFit >= 70, "平台和人群语言越贴近，代入感越强。"],
          ["合规底线是否可控", result.metrics.complianceSafety >= 70, "明显底线表达需在发布前处理。"]
        ];
        return checks.map(([item, passed, reason]) => `<li><span class="status-dot ${passed ? "pass" : "fail"}">${passed ? "✓" : "!"}</span><span><strong>${item}</strong><br>${reason}</span></li>`).join("");
      },
      goalLabel(value) {
        return {
          seeding: "种草",
          promotion: "促销转化",
          live: "直播带货",
          launch: "新品上市",
          trust_repair: "品牌信任修复",
          private_conversion: "私域社群转化"
        }[value] || "种草";
      },
      complianceLabel(value) {
        return {
          loose: "宽松：保留更多营销张力",
          balanced: "平衡：兼顾转化和可信",
          strict: "严格：适合高风险行业"
        }[value] || "平衡：兼顾转化和可信";
      },
      renderRiskSummary(result) {
        if (!result.riskItems.length) return `<span class="tag">暂无明显风险</span>`;
        const counts = {};
        result.riskItems.flatMap(item => item.riskTypes).forEach(type => {
          counts[type] = (counts[type] || 0) + 1;
        });
        return Object.entries(counts).map(([type, count]) => `<span class="tag danger">${TextToolkit.escapeHtml(type)} ${count}处</span>`).join("");
      },
      renderRiskItems(items) {
        if (!items.length) {
          return `<div class="rewrite-text">暂无明显信任阻碍点。仍建议发布前补充真实证据、适用条件和必要免责声明。</div>`;
        }
        return items.map(item => `
          <article class="risk-item ${item.riskLevel === "高" ? "high" : "medium"}">
            <p class="sentence">${TextToolkit.escapeHtml(item.sentence)}</p>
            <div class="tag-row">${item.riskTypes.map(type => `<span class="tag ${item.riskLevel === "高" ? "danger" : "warn"}">${TextToolkit.escapeHtml(type)}</span>`).join("")}<span class="tag">${item.riskLevel}风险</span></div>
            <p class="reason">${TextToolkit.escapeHtml(item.reason)}</p>
            <div class="tag-row">${item.affectedDimensionLabels.map(label => `<span class="tag">${TextToolkit.escapeHtml(label)}</span>`).join("")}</div>
            <p class="reason">需要补充：${TextToolkit.escapeHtml(item.evidenceNeeded || "暂无")}</p>
            <div class="rewrite-text">${TextToolkit.escapeHtml(item.rewrite)}</div>
          </article>
        `).join("");
      },
      renderTopRisks(result) {
        if (!result.riskItems.length) {
          return `<article class="top-risk-card low"><h3>暂无明显主要风险</h3><span class="status-label good">低风险</span><p class="reason">建议继续补充真实证据、适用条件和发布前复核记录。</p></article>`;
        }
        const levelWeight = { "高": 3, "中": 2, "低": 1 };
        const items = result.riskItems.slice().sort((a, b) => levelWeight[b.riskLevel] - levelWeight[a.riskLevel]).slice(0, 3);
        return items.map(item => `
          <article class="top-risk-card ${item.riskLevel === "高" ? "high" : item.riskLevel === "中" ? "medium" : "low"}">
            <h3>${TextToolkit.escapeHtml(item.riskTypes[0] || "内容风险")}</h3>
            <span class="status-label ${item.riskLevel === "高" ? "bad" : item.riskLevel === "中" ? "mid" : "good"}">${item.riskLevel}风险</span>
            <p class="reason"><strong>影响维度：</strong>${TextToolkit.escapeHtml(item.affectedDimensionLabels.join("、"))}</p>
            <p class="reason"><strong>主要原因：</strong>${TextToolkit.escapeHtml(item.reason)}</p>
            <p class="reason"><strong>优先建议：</strong>${TextToolkit.escapeHtml(item.guidance || item.rewrite)}</p>
          </article>
        `).join("");
      },
      renderRiskDimensions(dimensions) {
        const explain = {
          complianceExpression: "绝对化表达、功效承诺越多，该维度越高。",
          factualEvidence: "背书、数据、专家、检测来源不清会推高该分。",
          consumerMisleading: "效果承诺、焦虑话术和价格压力会影响消费者判断。",
          brandTrustRisk: "不透明、夸张或虚构表达会削弱品牌可信度。",
          platformRisk: "限时价格、导购属性和平台规则相关表达会提高风险。"
        };
        return Object.entries(dimensions).map(([key, value]) => {
          const color = value >= 70 ? "var(--red)" : value >= 40 ? "var(--amber)" : "var(--green)";
          return `
            <div class="dimension">
              <div class="dimension-head"><span>${RiskDimensionMeta[key].label}</span><span>${value}/100</span></div>
              <div class="bar-track"><div class="bar" style="width:${value}%;--bar-color:${color}"></div></div>
              <p class="reason">${explain[key]}</p>
            </div>
          `;
        }).join("");
      },
      renderTrustCards(dimensions) {
        const advice = {
          authenticity: "减少泛化体验和虚构场景，保留真实使用条件。",
          evidence: "补充数据来源、检测依据、样本范围或背书证明。",
          transparency: "明确广告、合作、试用、赞助或购买引导关系。",
          restraint: "减少绝对化、功效承诺和焦虑营销。",
          brandConsistency: "让语气更符合品牌定位，避免过度强推。"
        };
        return Object.entries(dimensions).map(([key, value]) => {
          const status = value >= 80 ? "优秀" : value >= 60 ? "一般" : "待优化";
          const cls = value >= 80 ? "good" : value >= 60 ? "mid" : "bad";
          return `
            <article class="trust-card">
              <div class="trust-score"><h3>${TrustDimensionMeta[key].label}</h3><strong>${value}</strong></div>
              <span class="status-label ${cls}">${status}</span>
              <p class="reason">${advice[key]}</p>
            </article>
          `;
        }).join("");
      },
      renderRiskTable(items) {
        if (!items.length) {
          return `<div class="rewrite-text">暂无明显信任阻碍点。仍建议发布前补充真实证据、适用条件和必要免责声明。</div>`;
        }
        return `
          <table class="risk-table">
            <thead>
              <tr>
                <th>原句</th>
                <th>风险标签</th>
                <th>等级</th>
                <th>风险原因</th>
                <th>需要补充的证据</th>
                <th>建议改写</th>
              </tr>
            </thead>
            <tbody>
              ${items.map(item => `
                <tr class="${item.riskLevel === "高" ? "high" : item.riskLevel === "中" ? "medium" : "low"}">
                  <td>${TextToolkit.escapeHtml(item.sentence)}</td>
                  <td><div class="tag-row">${item.riskTypes.map(type => `<span class="tag ${item.riskLevel === "高" ? "danger" : "warn"}">${TextToolkit.escapeHtml(type)}</span>`).join("")}</div></td>
                  <td><span class="status-label ${item.riskLevel === "高" ? "bad" : item.riskLevel === "中" ? "mid" : "good"}">${item.riskLevel}</span></td>
                  <td>${TextToolkit.escapeHtml(item.reason)}</td>
                  <td>${TextToolkit.escapeHtml(item.evidenceNeeded || "暂无")}</td>
                  <td>${TextToolkit.escapeHtml(item.rewrite)}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        `;
      },
      renderDimensions(dimensions, meta, color) {
        return Object.entries(dimensions).map(([key, value]) => `
          <div class="dimension">
            <div class="dimension-head"><span>${meta[key].label}</span><span>${value}/100</span></div>
            <div class="bar-track"><div class="bar" style="width:${value}%;--bar-color:${color}"></div></div>
            <p class="reason">${meta[key].label}权重 ${meta[key].weight}，分值由相关风险类型和出现频次计算。</p>
          </div>
        `).join("");
      },
      renderChecklist(items) {
        return items.map(item => `<li><span class="status-dot ${item.passed ? "pass" : "fail"}">${item.passed ? "✓" : "!"}</span><span>${TextToolkit.escapeHtml(item.item)}</span></li>`).join("");
      },
      rewriteCard(title, note, text, key, meta = []) {
        const metaLabels = ["适用平台", "适合人群", "保留的营销张力", "降低的信任阻碍", "转化逻辑说明"];
        return `
          <article class="rewrite-card">
            <h2>${title}</h2>
            <p class="subcopy">${note}</p>
            <div class="rewrite-text">${TextToolkit.escapeHtml(text)}</div>
            <div class="tag-row">${meta.map((item, index) => `<span class="tag">${metaLabels[index]}：${TextToolkit.escapeHtml(item)}</span>`).join("")}</div>
            <button class="secondary-btn" data-copy="${key}">复制改写</button>
          </article>
        `;
      },
      async loadKnowledgeBases() {
        this.appState.caseFilters = this.appState.caseFilters || { industry: "全部", platform: "全部", style: "全部" };
        try {
          const [caseData, legalData, platformData] = await Promise.all([
            getCases(),
            getLegalRules(),
            getPlatformRules()
          ]);
          this.appState.cases = caseData.cases || [];
          this.appState.caseLibraryNote = caseData.note || "";
          this.appState.legalRules = legalData.rules || [];
          this.appState.legalRulesNote = legalData.note || "";
          this.appState.platformRules = platformData.rules || [];
          this.appState.platformRulesNote = platformData.note || "";
          this.renderExamples();
          this.renderAbout();
        } catch (error) {
          this.appState.caseLibraryNote = "案例库暂时无法加载，请确认本地服务已启动。";
          this.renderExamples();
        }
      },
      renderExamples() {
        const grid = document.querySelector("#exampleGrid");
        const cases = this.appState.cases || [];
        const filters = this.appState.caseFilters || { industry: "全部", platform: "全部", style: "全部" };
        const options = key => ["全部", ...Array.from(new Set(cases.map(item => item[key]).filter(Boolean)))];
        const filtered = cases.filter(item => {
          return (filters.industry === "全部" || item.industry === filters.industry)
            && (filters.platform === "全部" || item.platform === filters.platform)
            && (filters.style === "全部" || item.style === filters.style);
        });
        if (!cases.length) {
          grid.innerHTML = `
            <section class="card">
              <h2>案例库加载中</h2>
              <p class="subcopy">${TextToolkit.escapeHtml(this.appState.caseLibraryNote || "正在读取模拟案例库。")}</p>
            </section>
          `;
          return;
        }

        grid.innerHTML = `
          <section class="case-library-shell">
            <aside class="case-filter-strip">
              <div>
                <span class="section-label">模拟案例库</span>
                <h2>优秀案例浏览</h2>
                <p class="subcopy">${TextToolkit.escapeHtml(this.appState.caseLibraryNote || "案例库为模拟案例，用于分析文案结构与转化机制，不代表真实品牌投放素材。")}</p>
              </div>
              ${this.filterSelect("行业", "industry", filters.industry, options("industry"))}
              ${this.filterSelect("平台", "platform", filters.platform, options("platform"))}
              ${this.filterSelect("营销风格", "style", filters.style, options("style"))}
              <div class="case-count"><strong>${filtered.length}</strong><span>个匹配案例</span></div>
            </aside>
            <div class="case-story-scroll">
              ${filtered.map((item, index) => this.caseShowcaseCard(item, index, filtered.length)).join("") || `<article class="card"><p class="subcopy">暂无匹配案例，请调整筛选条件。</p></article>`}
            </div>
          </section>
        `;
      },
      filterSelect(label, key, value, options) {
        return `
          <label class="compact-field">${label}
            <select data-case-filter="${key}">
              ${options.map(option => `<option value="${TextToolkit.escapeHtml(option)}" ${option === value ? "selected" : ""}>${TextToolkit.escapeHtml(option)}</option>`).join("")}
            </select>
          </label>
        `;
      },
      caseListCard(item) {
        return `
          <article class="case-row-card ${item.id === this.appState.selectedCaseId ? "active" : ""}">
            <div>
              <div class="tag-row">
                <span class="tag">${TextToolkit.escapeHtml(item.industry)}</span>
                <span class="tag">${TextToolkit.escapeHtml(item.platform)}</span>
                <span class="tag">${TextToolkit.escapeHtml(item.style)}</span>
              </div>
              <h3>${TextToolkit.escapeHtml(item.title)}</h3>
              <p class="subcopy">${TextToolkit.escapeHtml(item.scenario)}</p>
              <p>${TextToolkit.escapeHtml(item.copy)}</p>
            </div>
            <div class="case-actions">
              <button class="secondary-btn" type="button" data-case-detail="${TextToolkit.escapeHtml(item.id)}">查看分析</button>
              <button class="primary-btn" type="button" data-case-apply="${TextToolkit.escapeHtml(item.id)}">套用这个结构</button>
            </div>
          </article>
        `;
      },
      caseShowcaseCard(item, index, total) {
        return `
          <article class="case-showcase-card" id="case-${TextToolkit.escapeHtml(item.id)}">
            <div class="case-showcase-main">
              <div class="case-index">${String(index + 1).padStart(2, "0")} / ${total}</div>
              <div class="tag-row">
                <span class="tag">${TextToolkit.escapeHtml(item.industry)}</span>
                <span class="tag">${TextToolkit.escapeHtml(item.platform)}</span>
                <span class="tag">${TextToolkit.escapeHtml(item.style)}</span>
              </div>
              <h2>${TextToolkit.escapeHtml(item.title)}</h2>
              <p class="subcopy">${TextToolkit.escapeHtml(item.scenario)}</p>
              <blockquote>${TextToolkit.escapeHtml(item.copy)}</blockquote>
              <div class="case-actions inline">
                <button class="primary-btn" type="button" data-case-apply="${TextToolkit.escapeHtml(item.id)}">套用这个结构</button>
              </div>
            </div>
            <div class="case-showcase-analysis">
              <p class="subcopy">模拟案例，不代表真实品牌投放素材。</p>
              ${this.caseAnalysisBlock("为什么有效", item.whyItWorks)}
              ${this.caseAnalysisBlock("信任机制", item.trustMechanisms)}
              ${this.caseAnalysisBlock("转化机制", item.conversionMechanisms)}
              ${this.caseAnalysisBlock("可复用结构", item.usablePatterns)}
              ${this.caseAnalysisBlock("应避免表达", item.avoidPatterns)}
            </div>
          </article>
        `;
      },
      caseDetail(item) {
        return `
          <span class="section-label">完整分析</span>
          <h2>${TextToolkit.escapeHtml(item.title)}</h2>
          <p class="subcopy">模拟案例，不代表真实品牌投放素材。</p>
          <blockquote>${TextToolkit.escapeHtml(item.copy)}</blockquote>
          ${this.caseAnalysisBlock("为什么有效", item.whyItWorks)}
          ${this.caseAnalysisBlock("信任机制", item.trustMechanisms)}
          ${this.caseAnalysisBlock("转化机制", item.conversionMechanisms)}
          ${this.caseAnalysisBlock("可复用结构", item.usablePatterns)}
          ${this.caseAnalysisBlock("应避免表达", item.avoidPatterns)}
          <button class="primary-btn" type="button" data-case-apply="${TextToolkit.escapeHtml(item.id)}">套用这个结构</button>
        `;
      },
      caseAnalysisBlock(title, items = []) {
        return `
          <div class="case-analysis-block">
            <h3>${title}</h3>
            <ul>${items.map(item => `<li>${TextToolkit.escapeHtml(item)}</li>`).join("")}</ul>
          </div>
        `;
      },
      updateCaseFilter(key, value) {
        this.appState.caseFilters = { ...(this.appState.caseFilters || {}), [key]: value };
        this.appState.selectedCaseId = "";
        this.renderExamples();
      },
      selectCase(id) {
        this.appState.selectedCaseId = id;
        this.renderExamples();
      },
      applyCasePattern(id) {
        const item = (this.appState.cases || []).find(caseItem => caseItem.id === id);
        if (!item) return;
        document.querySelector("#productCategory").value = this.categoryValue(item.industry);
        document.querySelector("#sellingPoints").value = (item.usablePatterns || []).join("\n");
        document.querySelector("#proofMaterials").value = [...(item.trustMechanisms || []), "请替换为本产品真实证明材料"].join("\n");
        document.querySelector("#adText").value = item.copy;
        document.querySelector("#adGoal").value = item.scenario.includes("促销") || item.style.includes("转化") ? "promotion" : "seeding";
        this.setChoice("targetPlatform", this.platformValue(item.platform));
        this.setChoice("targetAudience", this.audienceValue(item.audience));
        this.setChoice("marketingStyle", this.styleValue(item.style));
        this.updateCharCount();
        this.switchPage("workspace");
        this.switchStage("input");
        this.toast("已套用案例结构，请替换为自己的产品信息");
      },
      categoryValue(label) {
        return {
          "美妆护肤": "beauty",
          "食品饮料": "food",
          "教育培训": "education",
          "服饰穿搭": "fashion",
          "数码家电": "digital",
          "宠物用品": "pet",
          "本地生活": "local_life",
          "AI工具": "ai_tool"
        }[label] || "other";
      },
      platformValue(label) {
        if (label === "小红书") return "xiaohongshu";
        if (label === "抖音") return "douyin";
        if (label === "视频号") return "shipinhao";
        if (label === "微信私域") return "wechat";
        if (label === "淘宝/天猫") return "tmall";
        if (label === "京东") return "jd";
        if (label === "线下海报") return "offline";
        return "general";
      },
      audienceValue(label = "") {
        if (label.includes("学生")) return "student";
        if (label.includes("白领")) return "white_collar";
        if (label.includes("成分")) return "ingredient";
        if (label.includes("价格")) return "price_sensitive";
        if (label.includes("功效")) return "result_oriented";
        if (label.includes("新手")) return "beginner";
        if (label.includes("专业")) return "expert";
        if (label.includes("宝妈")) return "mom";
        return "auto";
      },
      styleValue(label = "") {
        if (label.includes("种草")) return "seeding";
        if (label.includes("转化")) return "conversion";
        if (label.includes("紧迫")) return "gentle_urgency";
        if (label.includes("高级")) return "premium";
        if (label.includes("直播")) return "live_interactive";
        return "trustworthy";
      },
      loadSimulationCase(id) {
        const item = SimulationCases.find(caseItem => caseItem.id === id);
        if (!item) return;
        this.appState.selectedSimulationCase = id;
        document.querySelector("#productName").value = item.productName;
        document.querySelector("#productCategory").value = item.productCategory;
        document.querySelector("#priceRange").value = item.priceRange;
        document.querySelector("#sellingPoints").value = item.sellingPoints;
        document.querySelector("#proofMaterials").value = item.proofMaterials;
        document.querySelector("#adText").value = item.text;
        document.querySelector("#imageText").value = item.imageText;
        document.querySelector("#adGoal").value = item.adGoal;
        this.setChoice("targetPlatform", item.targetPlatform);
        this.setChoice("targetAudience", item.targetAudience);
        this.setChoice("marketingStyle", item.marketingStyle);
        this.setChoice("complianceStrength", item.complianceStrength);
        this.updateCharCount();
        this.renderSimulationCases();
        this.toast("已填入模拟素材");
      },
      renderAbout() {
        const grid = document.querySelector("#aboutGrid");
        if (!grid) return;
        const caseCount = (this.appState.cases || []).length || 18;
        const legalCount = (this.appState.legalRules || []).length || 10;
        const platformCount = (this.appState.platformRules || []).length || 7;
        grid.innerHTML = `
          <article class="about-card wide">
            <span class="section-label">产品定位</span>
            <h2>消费者信任与广告转化优化官</h2>
            <p class="subcopy">AdTrust AI 面向品牌营销、内容创作、电商运营和私域转化场景，帮助用户输入文案或图片素材后，生成消费者画像、五维营销评分、信任阻碍点、转化损耗点和多风格改写文案。</p>
          </article>
          <article class="about-card">
            <h2>模拟使用场景</h2>
            <p class="subcopy">运营人员输入广告文案或上传海报图片，系统完成图片文字提取、案例匹配、规则引用、诊断报告和改写追问，适合投放前评估、素材复盘、跨团队沟通和 A/B 测试准备。</p>
          </article>
          <article class="about-card">
            <h2>目标用户</h2>
            <p class="subcopy">品牌营销人员、中小商家、内容创作者、本地生活商家、电商运营、私域运营和 MCN 内容团队。</p>
          </article>
          <article class="about-card wide">
            <h2>技术架构</h2>
            <div class="architecture-grid">
              ${this.architectureItem("前端", "原生 ES Module + 组件化 UI，负责输入流程、图片预览、报告展示、案例库筛选和改写工作室。")}
              ${this.architectureItem("后端", "Express API，提供 /api/audit、/api/rewrite-chat、/api/extract-image、/api/cases、/api/legal-rules、/api/platform-rules。")}
              ${this.architectureItem("DeepSeek API", "服务端通过环境变量读取 Key，前端不接触密钥；未连通时自动进入本地演示模式。")}
              ${this.architectureItem("OCR/图片识别", "本地 OCR 与手动兜底结合，图片文字进入诊断上下文，支持图片广告素材分析。")}
              ${this.architectureItem("案例库", `${caseCount} 个模拟优秀案例，提供可复用文案结构、信任机制和转化机制。`)}
              ${this.architectureItem("法律文本库", `${legalCount} 条规则摘要，只提供风险提示和表达建议，不构成法律意见。`)}
              ${this.architectureItem("平台规则库", `${platformCount} 个平台表达策略摘要，用于生成平台适配建议，不代表平台审核结论。`)}
            </div>
          </article>
          <article class="about-card wide">
            <h2>核心工作流</h2>
            <div class="timeline-row compact">
              <span>素材输入</span>
              <span>图片识别</span>
              <span>案例与规则检索</span>
              <span>信任转化诊断</span>
              <span>多风格改写</span>
              <span>追问导出</span>
            </div>
          </article>
          <article class="about-card">
            <h2>优秀案例库</h2>
            <p class="subcopy">按行业、平台、人群和风格匹配相似案例，提取“为什么有效”“可复用结构”“应避免表达”，辅助生成更像真实营销工作的改写方案。</p>
          </article>
          <article class="about-card">
            <h2>法律规则库</h2>
            <p class="subcopy">覆盖绝对化表达、功效承诺、价格促销、广告可识别性、用户背书、AI真实性、教育、食品和美妆等主题，只做表达边界提醒。</p>
          </article>
          <article class="about-card">
            <h2>平台规则库</h2>
            <p class="subcopy">整理小红书、抖音、视频号、微信私域、淘宝/天猫、京东和线下海报的内容风格、推荐结构、信任信号和转化信号。</p>
          </article>
          <article class="about-card">
            <h2>有效性测试方案</h2>
            <p class="subcopy">准备美妆、食品、教育、AI工具等多行业样本，对比原文与优化文案在可信度、吸引力、圈层匹配和行动意愿上的变化，并记录不同人群的选择反馈。</p>
          </article>
          <article class="about-card">
            <h2>推广管理策略</h2>
            <p class="subcopy">先面向中小品牌、内容创作者、本地生活商家和私域团队，再扩展到电商运营、MCN机构和品牌营销团队。</p>
          </article>
          <article class="about-card wide">
            <h2>隐私与免责声明</h2>
            <p class="subcopy">请勿输入身份证号、手机号、客户名单、合同、未公开商业机密等敏感信息。本工具仅用于营销内容风险提示、消费者信任分析和文本优化建议，不构成法律意见或平台审核结论。</p>
          </article>
        `;
      },
      architectureItem(title, text) {
        return `<div class="architecture-item"><strong>${title}</strong><span>${TextToolkit.escapeHtml(text)}</span></div>`;
      },
      loadSample(index) {
        const sample = SampleRepository.items[index];
        document.querySelector("#productName").value = sample.title.replace("广告", "").replace("笔记", "");
        document.querySelector("#productCategory").value = sample.industry;
        document.querySelector("#priceRange").value = index === 0 ? "99-199元" : index === 1 ? "体验课29元起" : "活动价按页面为准";
        document.querySelector("#sellingPoints").value = index === 0 ? "肤感清爽\n主打提亮护理\n适合日常通勤" : index === 1 ? "一对一辅导\n课程规划清晰\n适合阶段提升" : "代餐场景\n便携冲泡\n活动价权益";
        document.querySelector("#proofMaterials").value = "可补充：用户反馈、活动规则、产品说明或检测依据";
        document.querySelector("#adText").value = sample.text;
        document.querySelector("#adGoal").value = index === 1 ? "promotion" : "seeding";
        this.updateCharCount();
        this.setChoice("targetPlatform", index === 0 ? "xiaohongshu" : index === 1 ? "wechat" : "douyin");
        this.setChoice("targetAudience", index === 0 ? "ingredient" : index === 1 ? "student" : "price_sensitive");
        this.setChoice("marketingStyle", index === 1 ? "conversion" : "seeding");
        this.setChoice("complianceStrength", "balanced");
        this.switchPage("workspace");
        this.switchStage("input");
        this.toast("示例已填入");
      },
      clearForm() {
        document.querySelector("#adText").value = "";
        ["productName", "priceRange", "sellingPoints", "proofMaterials", "imageText"].forEach(id => {
          document.querySelector(`#${id}`).value = "";
        });
        document.querySelector("#imageInput").value = "";
        document.querySelector("#imagePreviewGrid").innerHTML = "";
        this.appState.request.images = [];
        this.appState.chatHistory = [];
        this.appState.selectedRewriteKey = "platform";
        this.appState.finalVersion = null;
        this.updateCharCount();
        this.setChoice("targetPlatform", "general");
        this.setChoice("targetAudience", "auto");
        this.setChoice("marketingStyle", "trustworthy");
        this.setChoice("complianceStrength", "balanced");
        this.appState.result = null;
        document.querySelector("#reportBody").innerHTML = `<div class="empty"><div><div class="seal">诊</div><h2>暂无诊断结果</h2><p class="subcopy">请先提交产品信息和广告素材。</p></div></div>`;
        document.querySelector("#rewriteBody").innerHTML = `<div class="empty"><div><div class="seal">写</div><h2>暂无改写结果</h2><p class="subcopy">请先完成一次信任转化诊断。</p></div></div>`;
        this.switchStage("input");
      },
      copyByKey(key) {
        const finalVersion = this.appState.finalVersion || this.appState.result.finalVersion;
        const map = {
          highTrust: this.appState.result.rewrites.highTrustVersion,
          highConversion: this.appState.result.rewrites.highConversionVersion,
          seeding: this.appState.result.rewrites.seedingRealVersion,
          gentleUrgency: this.appState.result.rewrites.gentleUrgencyVersion,
          platform: this.appState.result.rewrites.platformVersion,
          current: this.getRewriteTextByKey(this.appState.selectedRewriteKey || "platform"),
          final: finalVersion ? `${finalVersion.finalTitle}\n\n${finalVersion.finalCopy}\n\nCTA：${finalVersion.cta}` : this.getRewriteTextByKey(this.appState.selectedRewriteKey || "platform"),
          report: this.appState.simulationMode ? this.buildSimulationReport() : this.appState.result.markdownReport
        };
        navigator.clipboard.writeText(map[key] || "").then(() => this.toast("已复制"));
      },
      downloadMarkdown(kind = "report") {
        const finalVersion = this.appState.finalVersion || this.appState.result.finalVersion;
        const isFinal = kind === "final";
        const content = this.appState.simulationMode && !isFinal
          ? this.buildSimulationReport()
          : isFinal && finalVersion
          ? `# ${finalVersion.finalTitle}\n\n${finalVersion.finalCopy}\n\n## CTA\n${finalVersion.cta}\n\n## 为什么这样写\n${(finalVersion.whyThisWorks || []).map(item => `- ${item}`).join("\n")}\n\n## A/B测试建议\n${(finalVersion.abTestSuggestion || []).map(item => `- ${item}`).join("\n")}`
          : isFinal
            ? `# AdTrust AI 最终投放文案\n\n${this.getRewriteTextByKey(this.appState.selectedRewriteKey || "platform")}`
            : this.appState.result.markdownReport;
        const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = this.appState.simulationMode && !isFinal ? "AdTrust-AI-模拟演示报告.md" : isFinal ? "AdTrust-AI-最终投放文案.md" : "AdTrust-AI-信任转化优化报告.md";
        link.click();
        URL.revokeObjectURL(url);
        if (this.appState.simulationMode && !isFinal) this.updateSimulationStep("export");
      },
      buildSimulationReport() {
        const result = this.appState.result;
        const request = result.request || {};
        const finalVersion = this.appState.finalVersion || result.finalVersion;
        return `# AdTrust AI 模拟演示报告

## 1. 输入素材
- 产品名称：${request.productName || result.basicInfo?.productName || "未填写"}
- 产品品类：${FieldLabels.industry?.[request.productCategory] || result.basicInfo?.category || "其他"}
- 价格区间：${request.priceRange || "未填写"}
- 目标平台：${MarketingOptimizer.platformLabels?.[request.targetPlatform] || result.basicInfo?.platform || "通用"}
- 目标消费者：${MarketingOptimizer.audienceLabels?.[request.targetAudience] || result.consumerProfile?.inferredAudience || "自动推断"}
- 证明材料：${request.proofMaterials || "未提供"}

### 广告文案
${result.originalText || request.text || ""}

### 图片文字模拟 / OCR结果
${request.imageText || (result.imageAnalysis?.imageTexts || []).join("\n") || "未提供图片文字"}

## 2. 消费者画像
- 推断目标人群：${result.consumerProfile?.inferredAudience || ""}
- 消费动机：${result.consumerProfile?.motivation || ""}
- 主要顾虑：${result.consumerProfile?.mainConcerns || ""}
- 购买触发点：${result.consumerProfile?.purchaseTrigger || ""}

## 3. 五维营销评分
- 消费者信任度：${result.metrics?.trustScore}
- 转化吸引力：${result.metrics?.conversionAppeal}
- 圈层匹配度：${result.metrics?.audienceFit}
- 卖点清晰度：${result.metrics?.sellingPointClarity}
- 合规安全度：${result.metrics?.complianceSafety}

## 4. 信任阻碍点
${(result.frictionItems || []).map(item => `- ${item.name || item}：${item.suggestion || item.impactOnTrust || ""}`).join("\n") || "- 暂无明显信任阻碍点"}

## 5. 转化损耗点
${(result.conversionLosses || []).map(item => `- ${item}`).join("\n") || "- 暂无明显转化损耗点"}

## 6. 图片广告分析
- 图片文字提取：${(result.imageAnalysis?.imageTexts || []).join("；") || request.imageText || "未提供"}
- 视觉层级判断：${result.imageAnalysis?.hierarchyJudgement || "待判断"}
- 主标题清晰度：${result.imageAnalysis?.headlineClarity || "待判断"}
- 卖点突出度：${result.imageAnalysis?.sellingPointVisibility || "待判断"}
- CTA 明确度：${result.imageAnalysis?.ctaClarity || "待判断"}
- 视觉信任感：${result.imageAnalysis?.visualTrust || "待判断"}

## 7. 参考案例
${(result.caseReferences || []).map(item => `- ${item.title || item.industry}（${item.platform || "通用"}）：${(item.whyItWorks || []).join("、")}；可复用结构：${(item.usablePatterns || []).join("、")}`).join("\n") || "- 暂无匹配案例"}

## 8. 规则摘要
${(result.legalReferences || []).map(item => `- ${item.topic}：${item.summary}；替代表达：${(item.saferAlternatives || item.allowedAlternatives || []).join("、")}`).join("\n") || "- 暂无匹配规则"}

## 9. 多风格改写
### 高信任版
${result.rewrites?.highTrustVersion || ""}

### 高转化版
${result.rewrites?.highConversionVersion || ""}

### 种草真实版
${result.rewrites?.seedingRealVersion || ""}

### 温和紧迫版
${result.rewrites?.gentleUrgencyVersion || ""}

### 平台适配版
${result.rewrites?.platformVersion || ""}

## 10. 对话追问记录
${(this.appState.chatHistory || []).map(item => `- ${item.role === "user" ? "用户" : "AdTrust AI"}：${item.content}`).join("\n") || "- 暂无追问记录"}

## 11. 最终投放版
${finalVersion ? `### ${finalVersion.finalTitle}\n${finalVersion.finalCopy}\n\nCTA：${finalVersion.cta}` : "尚未生成最终投放版"}

## 12. A/B 测试建议
${(finalVersion?.abTestSuggestion || ["A版突出信任依据，测试收藏和咨询。", "B版突出权益和CTA，测试点击和转化。"]).map(item => `- ${item}`).join("\n")}

## 13. 免责声明
${result.disclaimer || "本报告仅用于营销内容风险提示、消费者信任分析和文本优化建议，不构成法律意见或平台审核结论。"}`;
      },
      togglePresentationMode() {
        if (this.appState.simulationMode || document.body.classList.contains("presentation-mode")) {
          this.exitSimulationMode();
        } else {
          this.enterSimulationMode();
        }
      },
      loadHistory() {
        this.appState.history = storage.loadHistory();
      },
      saveHistory(result) {
        const record = {
          id: result.id,
          createdAt: result.createdAt,
          textPreview: (result.request.productName || result.originalText || "未命名广告").slice(0, 42),
          riskScore: result.metrics.complianceSafety,
          trustScore: result.metrics.trustScore,
          riskLevel: `信任${result.metrics.trustScore} / 转化${result.metrics.conversionAppeal}`,
          result
        };
        this.appState.history = [record, ...this.appState.history.filter(item => item.id !== record.id)].slice(0, 5);
        storage.saveHistory(this.appState.history);
        this.renderHistory();
      },
      renderHistory() {
        const html = this.appState.history.length
          ? this.appState.history.map(item => `
            <button class="history-item" type="button" data-history-id="${item.id}">
              <strong>${TextToolkit.escapeHtml(item.textPreview)}${item.textPreview.length >= 42 ? "..." : ""}</strong>
              <span>信任 ${item.trustScore} · 合规安全 ${item.riskScore} · ${item.riskLevel}</span>
            </button>
          `).join("")
          : `<p class="subcopy">暂无本地优化记录。记录只保存在当前浏览器，不会上传云端。</p>`;
        document.querySelectorAll("#homeHistoryList, #workspaceHistoryList").forEach(container => {
          container.innerHTML = html;
        });
      },
      loadHistoryResult(id) {
        const record = this.appState.history.find(item => item.id === id);
        if (!record) return;
        this.appState.result = record.result;
        this.appState.chatHistory = [];
        this.appState.selectedRewriteKey = "platform";
        this.appState.finalVersion = record.result.finalVersion || null;
        const request = record.result.request || {};
        document.querySelector("#adText").value = record.result.originalText || request.text || "";
        document.querySelector("#productName").value = request.productName || "";
        document.querySelector("#productCategory").value = request.productCategory || "beauty";
        document.querySelector("#priceRange").value = request.priceRange || "";
        document.querySelector("#sellingPoints").value = request.sellingPoints || "";
        document.querySelector("#proofMaterials").value = request.proofMaterials || "";
        document.querySelector("#adGoal").value = request.adGoal || "seeding";
        document.querySelector("#imageType").value = request.imageType || "poster";
        document.querySelector("#imageText").value = request.imageText || "";
        this.appState.request.images = request.images || [];
        this.renderImagePreviews();
        this.updateCharCount();
        this.setChoice("targetPlatform", request.targetPlatform || "general");
        this.setChoice("targetAudience", request.targetAudience || "auto");
        this.setChoice("marketingStyle", request.marketingStyle || "trustworthy");
        this.setChoice("complianceStrength", request.complianceStrength || "balanced");
        this.renderReport(record.result);
        this.renderRewrite(record.result);
        this.switchPage("workspace");
        this.switchStage("report");
      },
      toast(message) {
        const toast = document.querySelector("#toast");
        toast.textContent = message;
        toast.classList.add("show");
        window.setTimeout(() => toast.classList.remove("show"), 1800);
      }
    };

    UI.init();


