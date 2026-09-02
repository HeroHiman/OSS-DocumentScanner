<svelte:options accessors />

<script context="module" lang="ts">
    import SettingsSlider from '@shared/components/SettingsSlider.svelte';
    import FolderTextView from './FolderTextView.svelte';
    import { lc } from '@nativescript-community/l';
</script>

<script lang="ts">
    import dayjs from 'dayjs';
    import { pickDate } from '~/utils/ui';

    export let jpegQuality;
    export let folder;
    export let password;
    export let filename = null;
    export let showFilename = true;
    export let startDate: number = null;
    export let endDate: number = null;

    $: DEV_LOG && console.log('jpegQuality', jpegQuality);

    function onFolderSelect(e) {
        folder = e.text;
    }

    async function selectStartDate() {
        try {
            const date = await pickDate(startDate ? dayjs(startDate) : dayjs());
            if (date) {
                startDate = date;
            }
        } catch (error) {
            DEV_LOG && console.log('selectStartDate error', error);
        }
    }

    async function selectEndDate() {
        try {
            const date = await pickDate(endDate ? dayjs(endDate) : dayjs());
            if (date) {
                endDate = date;
            }
        } catch (error) {
            DEV_LOG && console.log('selectEndDate error', error);
        }
    }

    function clearDateFilter() {
        startDate = null;
        endDate = null;
    }
</script>

<gesturerootview padding="10 0 10 0" rows="auto">
    <scrollview height={420}>
        <stacklayout>
            <label class="sectionBigHeader" margin={10} text={lc('export_settings')} />
            <FolderTextView text={folder} on:folder={onFolderSelect} />
            {#if showFilename}
                <textfield
                    autocapitalizationType="none"
                    autocorrect={false}
                    hint={lc('pdf_filename')}
                    margin="5 10 5 10"
                    placeholder={lc('filename')}
                    returnKeyType="next"
                    text={filename}
                    variant="outline"
                    on:textChange={(e) => (filename = e['value'])}
                />
            {/if}
            <SettingsSlider margin="5 10 5 10" max={100} min={0} onChange={(value) => (jpegQuality = value)} step={1} title={lc('jpeg_quality')} value={jpegQuality} />
            <textfield
                autocapitalizationType="none"
                autocorrect={false}
                hint={lc('optional_pdf_password')}
                margin="5 10 5 10"
                placeholder={lc('password')}
                placeholderColor="gray"
                returnKeyType="done"
                secure={true}
                text={password}
                variant="outline"
                on:textChange={(e) => (password = e['value'].length ? e['value'] : null)}
            />

            <!-- Date Range Filter Section -->
            <gridlayout columns="*,auto" margin="10 10 4 10">
                <label col={0} class="sectionHeader" text={lc('filter_by_date')} verticalAlignment="center" />
                {#if startDate || endDate}
                    <label col={1} class="icon-btn" text="mdi-close-circle" fontSize={20} color="gray" verticalAlignment="center" on:tap={clearDateFilter} />
                {/if}
            </gridlayout>
            <gridlayout columns="*,*" margin="0 10 10 10">
                <gridlayout col={0} margin="0 4 0 0" padding="10 12" backgroundColor="#00000011" borderRadius={8} on:tap={selectStartDate} rows="auto,auto">
                    <label row={0} text={lc('from_date')} fontSize={11} color="gray" />
                    <label row={1} text={startDate ? dayjs(startDate).format('MMM D, YYYY') : lc('any_date')} fontSize={14} fontWeight="500" />
                </gridlayout>
                <gridlayout col={1} margin="0 0 0 4" padding="10 12" backgroundColor="#00000011" borderRadius={8} on:tap={selectEndDate} rows="auto,auto">
                    <label row={0} text={lc('to_date')} fontSize={11} color="gray" />
                    <label row={1} text={endDate ? dayjs(endDate).format('MMM D, YYYY') : lc('any_date')} fontSize={14} fontWeight="500" />
                </gridlayout>
            </gridlayout>
        </stacklayout>
    </scrollview>
</gesturerootview>
