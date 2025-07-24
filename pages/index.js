import Head from 'next/head';
import Link from 'next/link';
import { Button, PageHeader, Space, Typography, Steps } from '@arco-design/web-react';

const Step = Steps.Step;

import IconGithub from '../public/images/github.svg';

export default function Home() {
    return (
        <>
            <Head>
                <title>DBER</title>
                <meta
                    name="description"
                    content="Database design tool based on entity relation diagram"
                />
                <link rel="icon" href="/favicon.ico" />
                <style>{'body { overflow: auto !important; }'}</style>
            </Head>
            <div className="index-container">
                <PageHeader
                    style={{
                        background: 'var(--color-bg-2)',
                        position: 'sticky',
                        top: 0,
                        boxShadow: '1px 1px 1px rgba(0, 0, 0, 0.1)',
                        zIndex: 2,
                    }}
                    title="DBER"
                    subTitle="基于实体关系图的数据库设计工具，可用于血缘分析"
                />

                <div className="index-video-container">
                    <div className="faq">
                        <h2>FAQ</h2>
                        <dl>
                            <dt>Where is the data stored?</dt>
                            <dd>
                                Stored in local storage and indexDB, so it is best to make a backup before cleaning the browser.
                            </dd>
                            <dd>
                                <Link href="/graphs">
                                    <Button type="primary">
                                        进入编辑器 .
                                    </Button>
                                </Link>
                            </dd>
                        </dl>
                    </div>
                    <video src="/detail.mp4" muted autoPlay loop></video>
                </div>
            </div>
        </>
    );
}
