// @vitest-environment jsdom
/**
 * ticketParserPage.test.ts
 *
 * 覆盖页面自有的交互逻辑：文件格式校验、解析成功后的可见结果、错误展示与清除。
 *
 * 解析器本身（OFD / PDF / XBRL）由同目录的 `ticket*Parser.test.ts` 覆盖，这里只测页面
 * 这一层的接线，用真实 fixture + 真实解析器，避免 mock 掉被测行为。
 * `TicketImagePreview` 依赖 canvas 绘制，jsdom 下不可用，这里 stub 掉。
 */
import { mount, flushPromises } from '@vue/test-utils';
import { afterEach, describe, expect, it, vi } from 'vitest';

const imagePreview = vi.hoisted(() => ({ rendered: 0 }));

vi.mock('@/components/ticket/TicketImagePreview.vue', () => ({
  default: {
    name: 'TicketImagePreview',
    props: ['ticket'],
    setup() {
      imagePreview.rendered += 1;
      return () => null;
    },
  },
}));

import TicketParserPage from '@/pages/document/TicketParserPage.vue';

/** 测试用的文件选择回调容器，页面注册进来后由 open() 触发 */
const fileDialog = vi.hoisted(() => ({
  change: null as ((files: File[]) => void) | null,
}));

/** 由测试决定文件对话框回什么 */
let pickedFile: File | null = null;

vi.mock('@vueuse/core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@vueuse/core')>()),
  useFileDialog: () => ({
    // 点拖拽区会调 open()，用它把测试准备的文件回给页面，走真实交互路径
    open: () => fileDialog.change?.(pickedFile ? [pickedFile] : []),
    onChange: (callback: (files: File[]) => void) => {
      fileDialog.change = callback;
    },
    reset: () => {},
  }),
  useDropZone: () => ({ isOverDropZone: { value: false } }),
}));

function makeTicketFile(name: string, xml: string): File {
  return new File([xml], name);
}

/** 合成的 XBRL，覆盖前导零车次、金额、xsi:nil 三类关键行为 */
const TICKET_XML = `<?xml version="1.0" encoding="UTF-8"?>
<xbrl xmlns="http://www.xbrl.org/2003/instance"
      xmlns:rai="http://xbrl.mof.gov.cn/taxonomy/2023-12-31/rai"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <rai:TrainNumber>0107</rai:TrainNumber>
  <rai:DepartureStation>北京南</rai:DepartureStation>
  <rai:DestinationStation>上海虹桥</rai:DestinationStation>
  <rai:TravelDate>2025-08-16</rai:TravelDate>
  <rai:DepartureTime>17:40</rai:DepartureTime>
  <rai:SeatLevel>二等座</rai:SeatLevel>
  <rai:Carriage>06车</rai:Carriage>
  <rai:Seat>11A号</rai:Seat>
  <rai:Name>张三</rai:Name>
  <rai:Fare>78.00</rai:Fare>
  <rai:IssuePartyCode xsi:nil="true"/>
  <rai:UnknownField>extra-field-test</rai:UnknownField>
</xbrl>`;

/** 造一份带 rai_issuer_*.xml 附件的 OFD（fflate zip，与 build-ofd-fixture.mjs 同形） */
async function makeOFDFile(xml: string, name = 'ticket.ofd'): Promise<File> {
  const { zipSync, strToU8 } = await import('fflate');
  const ofdXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016"><ofd:DocBody><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>`;
  const attachment = 'rai_issuer_2023-12-31_synthetic-01.xml';
  const attXml = `<?xml version="1.0" encoding="UTF-8"?>
<ofd:Attachments xmlns:ofd="http://www.ofdspec.org/2016">
  <ofd:Attachment ID="1" Name="${attachment.replace(/\.xml$/, '')}" Format="xml">
    <ofd:FileLoc>Doc_0/Attachs/${attachment}</ofd:FileLoc>
  </ofd:Attachment>
</ofd:Attachments>`;
  const bytes = zipSync({
    'OFD.xml': strToU8(ofdXml),
    'Doc_0/Attachs/Attachments.xml': strToU8(attXml),
    [`Doc_0/Attachs/${attachment}`]: strToU8(xml),
  });
  return new File([bytes], name);
}

/** ToolPage 只负责渲染路由 meta，与本页交互无关，stub 成透传容器 */
function mountPage() {
  return mount(TicketParserPage, {
    attachTo: document.body,
    global: { stubs: { ToolPage: { template: '<div><slot /></div>' } } },
  });
}

const DROP_ZONE = '[role="button"][aria-label="选择或拖入 .ofd 或 .pdf 电子客票文件"]';

/**
 * 走「点拖拽区 → 打开文件对话框 → 选中文件」这条真实交互路径
 *
 * 直接调内部回调会绕开拖拽区的点击绑定，测不到「用户点了会发生什么」。
 */
async function chooseFile(wrapper: ReturnType<typeof mountPage>, file: File) {
  pickedFile = file;
  await wrapper.find(DROP_ZONE).trigger('click');
  await flushPromises();
}

afterEach(() => {
  pickedFile = null;
  fileDialog.change = null;
  vi.clearAllMocks();
});

describe('TicketParserPage 初始状态', () => {
  it('未选文件时不展示结果区', async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('点击选择文件，或将文件拖到这里');
    expect(wrapper.text()).not.toContain('常用信息');
    wrapper.unmount();
  });

  it('支持格式的提示同时覆盖 .ofd 与 .pdf', async () => {
    const wrapper = mountPage();
    await flushPromises();
    expect(wrapper.text()).toContain('.ofd');
    expect(wrapper.text()).toContain('.pdf');
    wrapper.unmount();
  });
});

describe('TicketParserPage 格式校验', () => {
  it('非 .ofd / .pdf 文件被拦下并给出可见错误', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, makeTicketFile('note.txt', 'hello'));

    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain('不支持的文件格式');
    expect(alert.text()).toContain('note.txt');
    expect(wrapper.text()).not.toContain('常用信息');
    wrapper.unmount();
  });

  it('.xml 后缀同样被拒（页面只吃容器格式）', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, makeTicketFile('rai_issuer_2023-12-31.xml', TICKET_XML));
    expect(wrapper.find('[role="alert"]').text()).toContain('不支持的文件格式');
    wrapper.unmount();
  });

  it('校验失败时不进入解析状态', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, makeTicketFile('note.txt', 'hello'));
    expect(wrapper.text()).not.toContain('解析中');
    wrapper.unmount();
  });
});

describe('TicketParserPage 解析成功', () => {
  it('展示常用信息：车次保留前导零、金额格式化、日期拼时间', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, await makeOFDFile(TICKET_XML));

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
    const text = wrapper.text();
    // 0107 一旦数字化就变成 107，这张票就认不出来了
    expect(text).toContain('0107');
    expect(text).toContain('北京南');
    expect(text).toContain('上海虹桥');
    expect(text).toContain('¥ 78.00');
    expect(text).toContain('2025年08月16日 17:40');
    expect(text).toContain('二等座 06车11A号');
    wrapper.unmount();
  });

  it('显示源文件名与提取出的附件名', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, await makeOFDFile(TICKET_XML));
    expect(wrapper.text()).toContain('ticket.ofd');
    expect(wrapper.text()).toContain('rai_issuer_2023-12-31_synthetic-01.xml');
    wrapper.unmount();
  });

  it('xsi:nil 字段不进常用信息，不显示成空行', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, await makeOFDFile(TICKET_XML));
    // IssuePartyCode 是 nil，不该出现在常用信息里
    expect(wrapper.find('dl').exists()).toBe(true);
    expect(wrapper.find('dl').text()).not.toContain('开票单位代码');
    wrapper.unmount();
  });

  it('架构外字段在字段明细里单独标出', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, await makeOFDFile(TICKET_XML));
    expect(wrapper.text()).toContain('以下字段不在铁路电子客票架构中');
    expect(wrapper.text()).toContain('UnknownField');
    wrapper.unmount();
  });

  it('触发车票图片预览', async () => {
    imagePreview.rendered = 0;
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, await makeOFDFile(TICKET_XML));
    expect(imagePreview.rendered).toBe(1);
    wrapper.unmount();
  });
});

describe('TicketParserPage 解析失败', () => {
  it('OFD 缺附件时显示解析器给出的原因', async () => {
    const { zipSync, strToU8 } = await import('fflate');
    const bytes = zipSync({
      'OFD.xml': strToU8(
        '<?xml version="1.0" encoding="UTF-8"?><ofd:OFD xmlns:ofd="http://www.ofdspec.org/2016"><ofd:DocBody><ofd:DocRoot>Doc_0/Document.xml</ofd:DocRoot></ofd:DocBody></ofd:OFD>'
      ),
    });

    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, new File([bytes], 'empty.ofd'));

    const alert = wrapper.find('[role="alert"]');
    expect(alert.exists()).toBe(true);
    expect(alert.text()).toContain('rai_issuer_');
    expect(wrapper.text()).not.toContain('常用信息');
    wrapper.unmount();
  });

  it('重新选一个坏文件时不残留上一次的结果', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, await makeOFDFile(TICKET_XML));
    expect(wrapper.text()).toContain('0107');

    await chooseFile(wrapper, makeTicketFile('note.txt', 'hello'));
    // 结果区必须已经清掉，不能把上一张票的字段继续展示给用户
    expect(wrapper.text()).not.toContain('常用信息');
    expect(wrapper.find('[role="alert"]').text()).toContain('不支持的文件格式');
    wrapper.unmount();
  });
});

describe('TicketParserPage 清除', () => {
  it('清除后回到初始态', async () => {
    const wrapper = mountPage();
    await flushPromises();
    await chooseFile(wrapper, await makeOFDFile(TICKET_XML));
    expect(wrapper.text()).toContain('解析结果');

    const clearButton = wrapper.findAll('button').find((b) => b.text().includes('清除'));
    expect(clearButton).toBeDefined();
    await clearButton!.trigger('click');
    await flushPromises();

    expect(wrapper.text()).toContain('点击选择文件，或将文件拖到这里');
    expect(wrapper.text()).not.toContain('解析结果');
    wrapper.unmount();
  });
});
